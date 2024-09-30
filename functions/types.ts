export interface MagentoProductBase {
    id: number;
    sku: string;
    name: string;
    price: number;
    status: number;
    visibility: number;
    type_id: string;
    created_at: string;
    updated_at: string;
    weight: number;
    custom_attributes: {
        attribute_code: string;
        value: string | string[];
    }[];
    media_gallery_entries: {
        id: number;
        media_type: string;
        label: string;
        position: number;
        disabled: boolean;
        types: string[];
        file: string;
        sku: string;
    }[];
}

export interface MagentoConfigurableProduct extends MagentoProductBase {
    type_id: 'configurable';
    extension_attributes: {
        configurable_product_options: {
            id: number;
            attribute_id: string;
            label: string;
            position: number;
            values: { value_index: number }[];
        }[];
        configurable_product_links: number[];
    };
}

export interface MagentoSimpleProduct extends MagentoProductBase {
    type_id: 'simple';
}

export type MagentoProduct = MagentoConfigurableProduct | MagentoSimpleProduct;

export interface MagentoResponse {
    items: MagentoProduct[];
    total_count: number;
}

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
    shopifyProductId?: string;
}

export interface FormattedVariant {
    price: string;
    inventoryItem: {
        sku: string;
        tracked?: boolean;
    }
    optionValues: {
        optionName: string;
        name: string;
    }[];
    media: {
        mediaContentType: 'IMAGE';
        originalSource: string;
        alt?: string;
    };
}

export interface AttributeOption {
    label: string;
    value: string;
}

export interface AttributeMetadata {
    attribute_id: string;
    attribute_code: string;
    default_frontend_label: string;
    frontend_input: string;
    options: AttributeOption[];
}

export interface AttributeMaps {
    idToLabel: Map<string, string>;
    codeToLabel: Map<string, string>;
    codeToOptions: Map<string, AttributeOption[]>;
}

export interface AttributeResponse {
    items: Array<AttributeMetadata & {
        is_wysiwyg_enabled: boolean;
        is_html_allowed_on_front: boolean;
        used_for_sort_by: boolean;
        is_filterable: boolean;
        is_filterable_in_search: boolean;
        is_used_in_grid: boolean;
        is_visible_in_grid: boolean;
        is_filterable_in_grid: boolean;
        position: number;
        apply_to: string[];
        is_searchable: string;
        is_visible_in_advanced_search: string;
        is_comparable: string;
        is_used_for_promo_rules: string;
        is_visible_on_front: string;
        used_in_product_listing: string;
        is_visible: boolean;
        scope: string;
        extension_attributes: AttributeExtensionAttributes;
    }>;
    total_count: number;
}
interface AttributeExtensionAttributes {
    filter_setting: AttributeFilterSetting;
}
interface AttributeFilterSetting {
    display_mode: number;
    follow_mode: number;
    filter_code: string;
    attribute_code: string;
    // ... other properties as needed
}


///////////////////////////////////////////////////

export interface ShopifyProduct {
    id: string;
    title: string;
    variants: {
        nodes: {
            id: string;
            title: string;
            selectedOptions: {
                name: string;
                value: string
            }[]
        }[]
    };
    media: {
        nodes: {
            id: string;
            alt: string;
        }[]
    }
}

export interface ShopifyVariant {
    id: string;
    title: string;
    sku: string;
}

export interface ShopifyError {
    field: string[];
    message: string;
    locations: any[]
}

export interface ShopifyResponse<T> {
    data: {
        productCreate: {
            product: ShopifyProduct;
            userErrors: any
        }
        products: FindProductsResponse
    };
    errors?: ShopifyError[];
    extensions: any;
}

export interface ProductCreateResponse {
    productCreate: {
        product: ShopifyProduct;
        userErrors: ShopifyError[];
    };
}

export interface VariantsBulkCreateResponse {
    productVariantsBulkCreate: {
        productVariants: ShopifyVariant[];
        userErrors: ShopifyError[];
    };
}

export interface FindProductsResponse {
    edges: {
        node: {
            id: string,
            title: string,
        }
    }[]

}