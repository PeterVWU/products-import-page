import { ShopifyResponse, FindProductsResponse } from './types';

interface Env {
    SHOPIFY_ADMIN_API_URL: string;
    SHOPIFY_ACCESS_TOKEN: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
    const request = context.request
    const env = context.env
    try {
        const requestData: { productTitles: string[] } = await request.json();
        console.log(requestData);
        const productTitles = requestData.productTitles
        const productIds = await Promise.all(productTitles.map(title => findProduct(title, env)))
        console.log('product Ids', productIds)
        return new Response(JSON.stringify(productIds.filter(p => p != undefined)), {
            headers: { 'Content-Type': 'application/json', "Access-Control-Allow-Origin": "*", },
        });
    } catch (error) {
        console.log('find product error', error)
        return new Response(`Error: ${(error as Error).message}`, { status: 500 });
    }
}

// find product exsit in shipfiy and return shopify product id
async function findProduct(title: string, env: Env): Promise<any> {
    const findProductQuery = `
	query Products {
		products(
			first: 10
			query: "title:${title}"
		) {
			edges {
				node {
					id
					title
				}
			}
		}
	}
	`
    const productResponse = await shopifyRequest<FindProductsResponse>(findProductQuery, {}, env);
    return productResponse.data.products.edges.map(product => ({
        title: title,
        id: product.node.id
    }))[0]
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