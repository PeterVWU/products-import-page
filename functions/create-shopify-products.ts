import { FormattedProduct, FormattedVariant, ProductCreateResponse, ShopifyProduct, ShopifyResponse, VariantsBulkCreateResponse, ShopifyMedia, ProductCreateMediaResponse } from './types';

interface Env {
    SHOPIFY_ADMIN_API_URL: string;
    SHOPIFY_ACCESS_TOKEN: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
    const request = context.request
    const env = context.env
    try {
        console.log('body: ', request.body)
        const products: FormattedProduct[] = await request.json();
        const results = await Promise.all(products.map(product => createShopifyProductWithVariants(product, env)));
        return new Response(JSON.stringify(results), {
            headers: { 'Content-Type': 'application/json', "Access-Control-Allow-Origin": "*", },
        });
    } catch (error) {
        console.log('create product error', error)
        return new Response(`Error: ${(error as Error).message}`, { status: 500 });
    }
}

async function createShopifyProductWithVariants(product: FormattedProduct, env: Env): Promise<string> {
    let shopifyProductId = product.shopifyProductId;
    let variants = product.variants;
    let media: ShopifyMedia[] = []
    if (!shopifyProductId) {
        // No product found in Shopify, create new product and images
        // and add product options, update the default variant.
        const createdShopifyProduct = await createProduct(product, env)
        shopifyProductId = createdShopifyProduct.shopifyProductId
        variants = createdShopifyProduct.variants
        media = createdShopifyProduct.media
    } else {
        // Product already exist in Shopify, just add new images.
        media = await createProductMedia(product, env)
    }
    // add the other variants
    if (variants.length > 0) {
        await createProductVariants(shopifyProductId, variants, media, env);
    }

    return shopifyProductId;
}

// add the product image to the product on shopify
async function createProductMedia(product: FormattedProduct, env: Env): Promise<ShopifyMedia[]> {
    const createProductMediaMutation = `
		mutation productCreateMedia($media: [CreateMediaInput!]!, $productId: ID!) {
			productCreateMedia(media: $media, productId: $productId) {
				media {
                    id
					alt
				}
				mediaUserErrors {
					field
					message
				}
				product {
					id
					title
				}
			}
		}

	`
    const productMediaVariables = {
        media: product.media,
        productId: product.shopifyProductId
    };

    const productMedia = await shopifyRequest<ProductCreateMediaResponse>(createProductMediaMutation, productMediaVariables, env);
    return productMedia.data.productCreateMedia.media
}

async function createProduct(product: FormattedProduct, env: Env): Promise<{ shopifyProductId: string, variants: FormattedVariant[], media: ShopifyMedia[] }> {
    const createProductMutation = `
	  mutation createProduct($input: ProductInput!, $media: [CreateMediaInput!]) {
		productCreate(input: $input, media: $media) {
		  product {
			id
			title
			variants(first: 5) {
				nodes {
				id
				title
				selectedOptions {
					name
					value
				}
			  }
			}
			media(first: 50) {
				nodes{
					id
					alt
				}
			}
		  }
		  userErrors {
			field
			message
		  }
		}
	  }
	`;

    const productVariables = {
        input: {
            title: product.title,
            descriptionHtml: product.descriptionHtml,
            vendor: product.vendor,
            productType: product.productType,
            status: "DRAFT",
            productOptions: product.productOptions,
            tags: product.tags,
            seo: {
                title: product.title,
                description: product.descriptionHtml.substring(0, 160) // Truncate for SEO description
            },
            metafields: product.metafields,
        },
        media: product.media,
    };
    console.log('creating product', product.title)
    const productResponse = await shopifyRequest<ProductCreateResponse>(createProductMutation, productVariables, env);
    console.log('userErrors', productResponse.data.productCreate.userErrors)
    const createdProduct = productResponse.data.productCreate.product;

    // find the default variant created by shopify update that variant
    let defaultVariant: FormattedVariant | null = null;
    const filteredVariants = product.variants.filter(variant => {
        const isDefaultVariant = variant.optionValues.every(option => {
            return createdProduct.variants.nodes[0].selectedOptions.some(o => {
                return o.name == option.optionName && o.value == option.name
            })
        })
        if (isDefaultVariant) {
            defaultVariant = variant;
        }
        return !isDefaultVariant
    })
    if (defaultVariant) {
        await updateVariant(createdProduct, defaultVariant, env)
    }
    return { shopifyProductId: createdProduct.id, variants: filteredVariants, media: createdProduct.media.nodes }
}

async function updateVariant(product: ShopifyProduct, variant: FormattedVariant, env: Env): Promise<ShopifyResponse<VariantsBulkCreateResponse>> {
    // On product creation, a default veriant will be created based on the options.
    // but this veriant is not tracked, we need to set track to true
    const updateVariantsMutation = `
		mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
		productVariantsBulkUpdate(productId: $productId, variants: $variants) {
			product {
			id
			}
			productVariants {
			id
			metafields(first: 2) {
				edges {
				node {
					namespace
					key
					value
				}
				}
			}
			}
			userErrors {
			field
			message
			}
		}
		}
	`;

    const mediaId = product.media.nodes.filter(node => node.alt == variant.media.alt)[0]?.id

    const variantVariables = {
        productId: product.id,
        variants: [
            {
                id: product.variants.nodes[0].id,
                price: variant.price,
                optionValues: variant.optionValues,
                inventoryItem: {
                    sku: variant.inventoryItem.sku,
                    tracked: true
                },
                mediaId
            }
        ]

    };
    return await shopifyRequest<VariantsBulkCreateResponse>(updateVariantsMutation, variantVariables, env);
}

async function createProductVariants(productId: string, variants: FormattedVariant[], media: ShopifyMedia[], env: Env): Promise<ShopifyResponse<VariantsBulkCreateResponse>> {
    const createVariantsMutation = `
	  mutation createProductVariants($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
		productVariantsBulkCreate(productId: $productId, variants: $variants) {
		  productVariants {
			id
			title
			sku
		  }
		  userErrors {
			field
			message
		  }
		}
	  }
	`;

    const variantVariables = {
        productId,
        variants: variants.map(variant => {
            return formatVariant(variant, media)
        }),
    };
    return await shopifyRequest<VariantsBulkCreateResponse>(createVariantsMutation, variantVariables, env);
}
function formatVariant(variant: FormattedVariant, media: ShopifyMedia[]): Record<string, any> {
    // assgin image to variant
    const mediaId = media.filter(node => node.alt == variant.media.alt)[0]?.id
    return {
        price: variant.price,
        optionValues: variant.optionValues,
        inventoryItem: {
            sku: variant.inventoryItem.sku,
            tracked: true
        },
        mediaId
    };
}

async function shopifyRequest<T>(query: string, variables: Record<string, any>, env: Env): Promise<ShopifyResponse<T>> {
    const response = await fetch(env.SHOPIFY_ADMIN_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': env.SHOPIFY_ACCESS_TOKEN,
        },
        body: JSON.stringify({ query, variables }),
    });

    const result: ShopifyResponse<T> = await response.json();
    console.log('shopify result', result)
    if (result.errors) {
        console.log('shopify error', result.errors)
        throw new Error(result.errors[0].message);
    }

    return result;
}