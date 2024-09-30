export interface FormattedProduct {
    title: string;
    sku: string;
    descriptionHtml: string;
    vendor: string;
    productType: string;
    tags: string[];
    status: 'ACTIVE' | 'ARCHIVED' | 'DRAFT';
    productOptions: {
        name: string;
        values: { name: string }[];
    }[];
    variants: FormattedVariant[];
    media: {
        mediaContentType: 'IMAGE';
        originalSource: string;
        alt?: string;
    }[];
    metafields: {
        key: string;
        namespace: string;
        type: string;
        value: string;
    }[];
    shopifyProductId: string;
}

export interface FormattedVariant {
    price: string;
    inventoryItem: {
        sku: string;
    }
    optionValues: {
        optionName: string;
        name: string;
    }[];
}
export interface ProductShopifyIdsType {
    title: string,
    id: string,
}