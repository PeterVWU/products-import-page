import { MagentoProduct, MagentoResponse, MagentoConfigurableProduct, MagentoSimpleProduct, FormattedProduct, FormattedVariant, AttributeResponse, AttributeMaps, AttributeOption } from "./types";

function isConfigurableProduct(product: MagentoProduct): product is MagentoConfigurableProduct {
    return product.type_id === 'configurable';
}

function formatProduct(product: MagentoConfigurableProduct, variants: MagentoSimpleProduct[], attributeMaps: AttributeMaps): FormattedProduct {
    const options = product.extension_attributes.configurable_product_options.map(option => {
        const optionName = attributeMaps.idToLabel.get(option.attribute_id) || option.label;
        const attributeCode = Array.from(attributeMaps.codeToLabel.entries())
            .find(([code, label]) => label === optionName)?.[0];
        const optionValues = attributeCode ? attributeMaps.codeToOptions.get(attributeCode) : undefined;

        return {
            name: optionName,
            values: option.values.map(v => {
                const matchingOption = optionValues?.find(opt => opt.value === v.value_index.toString());
                return { name: matchingOption ? matchingOption.label : v.value_index.toString() };
            })
        };
    }).filter(option => option.values.length > 1);

    const formattedVariants = variants.map(variant => formatVariant(variant, options, attributeMaps));

    // find all product options from the variants 
    const productOptions = formattedVariants.reduce((options, variant) => {
        variant.optionValues.forEach(variantOption => {
            const foundOption = options.find(option => option.name == variantOption.optionName)
            if (foundOption) {
                const foundValue = foundOption.values.find(value => value.name === variantOption.name)
                if (!foundValue) {
                    foundOption.values.push({ name: variantOption.name })
                }
            } else {
                const newOption = { name: variantOption.optionName, values: [{ name: variantOption.name }] }
                options.push(newOption)
            }
        })
        return options
    }, [] as { name: string, values: { name: string }[] }[])
    const variantsMedia = variants.map(variant => {
        return {
            mediaContentType: 'IMAGE' as const,
            originalSource: `https://vapewholesaleusa.com/media/catalog/product/${variant.media_gallery_entries[0]?.file}`,
            alt: variant.name,
        }
    });
    const tags = product.custom_attributes
        .find(attr => attr.attribute_code === 'category_ids')?.value as string[] || [];

    const brand = product.custom_attributes.find(attr => attr.attribute_code === 'brand')?.value
    const vendor = attributeMaps.codeToOptions.get('brand')?.find(brandObj => brandObj.value == brand)?.label || ''
    return {
        title: product.name,
        sku: product.sku,
        vendor: vendor,
        descriptionHtml: product.custom_attributes.find(attr => attr.attribute_code === 'description')?.value as string || '',
        productType: product.custom_attributes.find(attr => attr.attribute_code === 'product_type')?.value as string || '',
        tags: tags,
        status: product.status === 1 ? 'ACTIVE' : 'DRAFT',
        productOptions,
        variants: formattedVariants,
        media: variantsMedia,
        metafields: product.custom_attributes.map(attr => ({
            key: attributeMaps.codeToLabel.get(attr.attribute_code) || attr.attribute_code,
            namespace: 'magento_import',
            type: 'string',
            value: Array.isArray(attr.value) ? attr.value.join(',') : attr.value.toString()
        })).filter(attr => attr.key !== "Short Description")
    };
}

function formatSimpleProduct(product: MagentoSimpleProduct, attributeMaps: AttributeMaps): FormattedProduct {
    const media = product.media_gallery_entries.map(entry => ({
        mediaContentType: 'IMAGE' as const,
        originalSource: `https://vapewholesaleusa.com/media/catalog/product/${entry.file}`,
        alt: entry.label
    }));

    const tags = product.custom_attributes
        .find(attr => attr.attribute_code === 'category_ids')?.value as string[] || [];

    return {
        title: product.name,
        sku: product.sku,
        descriptionHtml: product.custom_attributes.find(attr => attr.attribute_code === 'description')?.value as string || '',
        vendor: product.custom_attributes.find(attr => attr.attribute_code === 'manufacturer')?.value as string || '',
        productType: product.custom_attributes.find(attr => attr.attribute_code === 'product_type')?.value as string || '',
        tags: tags,
        status: product.status === 1 ? 'ACTIVE' : 'DRAFT',
        productOptions: [], // Simple products don't have configurable options
        variants: [formatVariant(product, [], attributeMaps)], // The product itself is the only variant
        media: media,
        metafields: product.custom_attributes.map(attr => ({
            key: attributeMaps.codeToLabel.get(attr.attribute_code) || attr.attribute_code,
            namespace: 'magento_import',
            type: 'string',
            value: Array.isArray(attr.value) ? attr.value.join(',') : attr.value.toString()
        })).filter(attr => attr.key !== "Short Description")
    };
}

function formatVariant(variant: MagentoSimpleProduct, options: { name: string; values: { name: string }[] }[], attributeMaps: AttributeMaps): FormattedVariant {
    const optionValues = options.map(option => {
        const attributeCode = Array.from(attributeMaps.codeToLabel.entries())
            .find(([code, label]) => label === option.name)?.[0];
        const value = variant.custom_attributes.find(attr => attr.attribute_code === attributeCode)?.value;
        const optionValues = attributeCode ? attributeMaps.codeToOptions.get(attributeCode) : undefined;
        const matchingOption = optionValues?.find(opt => opt.value === value);

        return {
            name: option.name,
            value: matchingOption ? matchingOption.label : (value as string) || ''
        };
    });
    const media = {
        originalSource: `https://vapewholesaleusa.com/media/catalog/product/${variant.media_gallery_entries[0]?.file}`,
        alt: variant.name,
        mediaContentType: 'IMAGE' as const,
    }
    return {
        price: variant.price.toString(),
        inventoryItem: { sku: variant.sku },
        media,
        optionValues: optionValues.map(option => {
            return {
                optionName: option.name,
                name: option.value
            }
        })
    };
}

async function fetchAttributeMetadata(env: Env): Promise<AttributeMaps> {
    const url = `${env.MAGENTO_API_URL}/rest/V1/products/attributes?searchCriteria[pageSize]=500&searchCriteria[currentPage]=1`;
    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${env.MAGENTO_API_TOKEN}`,
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch attribute metadata: ${response.statusText}`);
    }

    const data: AttributeResponse = await response.json();
    const idToLabel = new Map<string, string>();
    const codeToLabel = new Map<string, string>();
    const codeToOptions = new Map<string, AttributeOption[]>();

    for (const item of data.items) {
        idToLabel.set(item.attribute_id, item.default_frontend_label);
        codeToLabel.set(item.attribute_code, item.default_frontend_label);
        if (item.options && item.options.length > 0) {
            codeToOptions.set(item.attribute_code, item.options.filter((option: any) => option.value !== ''));
        }
    }

    return { idToLabel, codeToLabel, codeToOptions };
}

function extractConfigurableProductName(simpleName: string): string {
    const parts = simpleName.split('-');
    const mainName = parts[0].split(' ').slice(0, -1).join(' ')

    return `%${mainName.trim()}%`;
}

function configurableProductParams(names: string[]): string {
    return names.map((name, index) => {
        const formatedName = `%${name}%`
        let query = `searchCriteria[filterGroups][0][filters][${index}][field]=name&`
        query += `searchCriteria[filterGroups][0][filters][${index}][value]=${encodeURIComponent(formatedName)}&`
        query += `searchCriteria[filterGroups][0][filters][${index}][condition_type]=like&`
        return query
    }).join('')
}

async function fetchConfigurableProducts(env: Env, names: string[]): Promise<MagentoConfigurableProduct[]> {
    const namesParam = configurableProductParams(names);
    const url = `${env.MAGENTO_API_URL}/rest/V1/products?${namesParam}searchCriteria[filterGroups][1][filters][0][field]=type_id&searchCriteria[filterGroups][1][filters][0][value]=configurable`;
    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${env.MAGENTO_API_TOKEN}`,
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch configurable products: ${response.statusText}`);
    }

    const data: MagentoResponse = await response.json();
    return data.items.filter(isConfigurableProduct);
}

async function handleRequest(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname, searchParams } = url;
    console.log('handleRequest')

    try {
        console.log('Fetching attribute metadata...');
        const attributeMaps = await fetchAttributeMetadata(env);
        let fromDate = searchParams.get('fromDate');
        let toDate = searchParams.get('toDate');

        if (!fromDate && !toDate) {
            // If neither date is provided, default to the last day
            const date = new Date();
            date.setDate(date.getDate() - 1);
            fromDate = date.toISOString().split('T')[0];
            toDate = new Date().toISOString().split('T')[0];
        } else if (!fromDate && toDate) {
            // If only toDate is provided, set fromDate to 1 day before
            fromDate = toDate;
        } else if (!toDate) {
            // If only fromDate is provided, set toDate to current date
            toDate = new Date().toISOString().split('T')[0];
        }
        // format date for Magento
        fromDate += ' 00:00:00'
        toDate += ' 23:59:59'

        console.log('Fetching products...');
        const productsUrl = `${env.MAGENTO_API_URL}/rest/V1/products?` +
            `searchCriteria[filterGroups][0][filters][0][field]=created_at&` +
            `searchCriteria[filterGroups][0][filters][0][value]=${fromDate}&` +
            `searchCriteria[filterGroups][0][filters][0][conditionType]=gteq&` +
            `searchCriteria[filterGroups][1][filters][0][field]=created_at&` +
            `searchCriteria[filterGroups][1][filters][0][value]=${toDate}&` +
            `searchCriteria[filterGroups][1][filters][0][conditionType]=lteq&` +
            `searchCriteria[sortOrders][0][field]=created_at&` +
            `searchCriteria[sortOrders][0][direction]=DESC&` +
            `searchCriteria[pageSize]=100&` +
            `searchCriteria[currentPage]=1`;

        console.log('Magento API URL:', productsUrl);

        const response = await fetch(productsUrl, {
            headers: {
                'Authorization': `Bearer ${env.MAGENTO_API_TOKEN}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`Magento API responded with status: ${response.status}`);
        }

        const data: MagentoResponse = await response.json();
        console.log('Received data from Magento API');
        const allProducts = data.items.filter(product => product.status == 1)
        if (allProducts.length === 0) {
            return new Response(JSON.stringify(
                {
                    products: [],
                    total_count: 0,
                    from_date: fromDate,
                    to_date: toDate,
                    org: data
                }), {
                headers: { 'Content-Type': 'application/json' },
            });
        }
        // const configurableProducts = data.items.filter(isConfigurableProduct);
        // console.log('configurableProducts', configurableProducts.length)
        const simpleProducts = allProducts.filter(product => !isConfigurableProduct(product)) as MagentoSimpleProduct[];
        console.log('simpleProducts', simpleProducts.length)

        // Extract potential configurable product names
        const configurableNames = new Set(simpleProducts.map(product => extractConfigurableProductName(product.name)));

        // Fetch relevant configurable products
        const configurableProducts = await fetchConfigurableProducts(env, Array.from(configurableNames));
        // console.log('configurableProducts', configurableProducts.map(p => p.name))

        const groupedProducts = new Map<number, { configurable: MagentoConfigurableProduct, simples: MagentoSimpleProduct[] }>();

        // Match simple products with their configurable parents
        const productMap = new Map<number, MagentoConfigurableProduct>();
        configurableProducts.forEach(configProduct => {
            groupedProducts.set(configProduct.id, { configurable: configProduct, simples: [] });
        });

        simpleProducts.forEach(simpleProduct => {
            for (const [configId, group] of groupedProducts) {
                if (group.configurable.extension_attributes.configurable_product_links.includes(simpleProduct.id)) {
                    group.simples.push(simpleProduct);
                    break;
                }
            }
        });

        // Format products
        const formattedProducts = Array.from(groupedProducts.values()).map(group =>
            formatProduct(group.configurable, group.simples, attributeMaps)
        );

        // Handle standalone simple products
        const standaloneSimples = simpleProducts.filter(simpleProduct =>
            !Array.from(groupedProducts.values()).some(group =>
                group.simples.some(variant => variant.id === simpleProduct.id)
            )
        );

        formattedProducts.push(...standaloneSimples.map(simpleProduct =>
            formatSimpleProduct(simpleProduct, attributeMaps)
        ));
        return new Response(JSON.stringify(
            {
                products: formattedProducts,
                total_count: formattedProducts.length,
                from_date: fromDate,
                to_date: toDate,
                org: data
            }), {
            headers: { 'Content-Type': 'application/json', "Access-Control-Allow-Origin": "*", },
        });
    } catch (error: any) {
        console.error('Error in /fetch-new-magento-products:', error);
        return new Response(`Error fetching products: ${error.message}`, { status: 500 });
    }


    return new Response('Not Found', { status: 404 });
}
interface Env {
    MAGENTO_API_URL: string;
    MAGENTO_API_TOKEN: string;
}


export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        return await handleRequest(context.request, context.env);
    } catch (error: any) {
        console.error('Unhandled error:', error);
        return new Response(`Unhandled error: ${error.message}`, { status: 500 });
    }
}