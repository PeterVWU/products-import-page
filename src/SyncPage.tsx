// syncPage
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

import { FormattedProduct, ProductShopifyIdsType } from "./types";


// Utility function to get today's date in YYYY-MM-DD format
const getTodayDate = () => new Date().toISOString().split('T')[0];
const domain = "http://localhost:8788"

const SyncPage: React.FC = () => {
    const [fromDate, setFromDate] = useState<string>(getTodayDate());
    const [toDate, setToDate] = useState<string>(getTodayDate());
    const [products, setProducts] = useState<FormattedProduct[]>([]);
    const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    useEffect(() => {
        // Clear messages when products change
        setError(null);
        setSuccessMessage(null);
    }, [products]);

    const fetchMagentoProducts = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const datePram = fromDate != toDate ? `?fromDate=${fromDate}&toDate=${toDate}` : `?toDate=${toDate}`
            const response = await fetch(`${domain}/fetch-new-magento-products${datePram}`);
            if (!response.ok) {
                throw new Error('Failed to fetch products from Magento');
            }
            const data: { products: FormattedProduct[] } = await response.json();
            const productShopifyIds = await findShopifyProducts(data.products.map(product => product.title));
            const productsWithShopifyId = appendShopifyProductId(data.products, productShopifyIds);
            setProducts(productsWithShopifyId);
            setSuccessMessage(`Successfully fetched ${productsWithShopifyId.length} products from Magento.`);
        } catch (error) {
            console.error('Error fetching Magento products:', error);
            setError('Failed to fetch products from Magento. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const appendShopifyProductId = (products: FormattedProduct[], productShopifyIds: ProductShopifyIdsType[]): FormattedProduct[] => {
        console.log('productShopifyIds', productShopifyIds)
        return products.map(product => {
            const shopifyProductId = productShopifyIds.find(shopifyProduct => {
                return shopifyProduct.title === product.title
            })
            if (shopifyProductId) {
                product.shopifyProductId = shopifyProductId.id
            }
            return product
        })
    }

    const createShopifyProducts = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const productsToCreate = products.filter((_, index) => selectedProducts.includes(index.toString()));
            const response = await fetch(`${domain}/create-shopify-products`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(productsToCreate),
            });
            if (!response.ok) {
                throw new Error('Failed to create products in Shopify');
            }
            setSuccessMessage(`Successfully created ${productsToCreate.length} products in Shopify.`);
            setSelectedProducts([]);
        } catch (error) {
            console.error('Error creating Shopify products:', error);
            setError('Failed to create products in Shopify. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const findShopifyProducts = async (productTitles: string[]) => {
        console.log('productTitles', productTitles)
        return []
        // const response = await fetch(`${domain}/find-shopify-products`, {
        //     method: 'POST',
        //     headers: {
        //         'Content-Type': 'application/json',
        //     },
        //     body: JSON.stringify({ productTitles: productTitles }),
        // })

        // if (!response.ok) {
        //     throw new Error('Failed to create products in Shopify');
        // }
        // const data: ProductShopifyIdsType[] = await response.json();
        // console.log('findshopfiyproducts', data)
        // return data
    }

    const handleProductSelection = (index: number) => {
        setSelectedProducts(prev =>
            prev.includes(index.toString())
                ? prev.filter(id => id !== index.toString())
                : [...prev, index.toString()]
        );
    };

    const handleSelectAll = () => {
        if (selectedProducts.length === products.length) {
            setSelectedProducts([]);
        } else {
            setSelectedProducts(products.map((_, index) => index.toString()));
        }
    };
    return (
        <div className="container mx-auto p-4">
            <h1 className="text-3xl font-bold mb-6">Magento to Shopify Sync</h1>

            <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                    <Label htmlFor="fromDate">From Date</Label>
                    <Input
                        type="date"
                        id="fromDate"
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                    />
                </div>
                <div>
                    <Label htmlFor="toDate">To Date</Label>
                    <Input
                        type="date"
                        id="toDate"
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                    />
                </div>
            </div>

            <Button onClick={fetchMagentoProducts} disabled={isLoading} className="mb-6">
                {isLoading ? 'Fetching...' : 'Fetch Magento Products'}
            </Button>

            {error && (
                <Alert variant="destructive" className="mb-6">
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {successMessage && (
                <Alert variant="default" className="mb-6">
                    <AlertTitle>Success</AlertTitle>
                    <AlertDescription>{successMessage}</AlertDescription>
                </Alert>
            )}

            {products.length > 0 && (
                <div className="mt-6">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold">Products ({products.length})</h2>
                        <Button onClick={handleSelectAll} variant="outline">
                            {selectedProducts.length === products.length ? 'Deselect All' : 'Select All'}
                        </Button>
                    </div>

                    <Accordion type="single" collapsible className="w-full">
                        {products.map((product, index) => (
                            <AccordionItem value={`item-${index}`} key={index}>
                                <AccordionTrigger className="flex justify-between">
                                    <div className="flex items-center">
                                        <Checkbox
                                            id={`product-${index}`}
                                            checked={selectedProducts.includes(index.toString())}
                                            onCheckedChange={() => handleProductSelection(index)}
                                            onClick={(event) => event.stopPropagation()}
                                            className="mr-2"
                                        />
                                        <span>{product.title}</span>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent>
                                    <div className="pl-6">
                                        <p>{product.shopifyProductId ? "Exist in shopify" : "New product"}</p>

                                        <h4 className="font-semibold mt-2">Variants:</h4>
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>SKU</TableHead>
                                                    <TableHead>Price</TableHead>
                                                    <TableHead>Options</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {product.variants.map((variant, vIndex) => (
                                                    <TableRow key={vIndex}>
                                                        <TableCell>{variant.inventoryItem.sku}</TableCell>
                                                        <TableCell>{variant.price}</TableCell>
                                                        <TableCell>
                                                            {variant.optionValues.map((ov, ovIndex) => (
                                                                <span key={ovIndex}>
                                                                    {ov.optionName}: {ov.name}
                                                                    {ovIndex < variant.optionValues.length - 1 ? ', ' : ''}
                                                                </span>
                                                            ))}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>

                    <Button
                        onClick={createShopifyProducts}
                        disabled={isLoading || selectedProducts.length === 0}
                        className="mt-6"
                    >
                        {isLoading ? 'Creating...' : `Create Selected Products (${selectedProducts.length}) in Shopify`}
                    </Button>
                </div>
            )}
        </div>
    );
};

export default SyncPage;