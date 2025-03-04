// noinspection JSUnresolvedReference

/**
 * Copyright © Acid Unit (https://acid.7prism.com). All rights reserved.
 * See LICENSE file for license details.
 */

define([
    'jquery',
    'ko',
    './../action/push',
    './../model/cart-item-data',
    './../model/product-data',
    'Magento_Customer/js/customer-data'
], function (
    $,
    ko,
    push,
    cartItemDataModel,
    productDataModel,
    customerData
) {
    'use strict';

    return {
        gtmConfig: window.acidGtmConfig ? window.acidGtmConfig : {},
        productData: window.acidProductData ? window.acidProductData : {},
        generalConfig: window.acidGeneralConfig ? window.acidGeneralConfig : {},
        cartCustomerData: customerData.get('cart'),

        /**
         * window.acidSwatchData is populated dynamically via JS, we can't use that object on initialization
         * because we can't be sure it contains all the data at that moment
         */
        swatchData: [],

        checkoutStepsModel: {
            shipping: {
                code: 'shipping',
                number: 1
            },
            payment: {
                code: 'payment',
                number: 2
            }
        },

        quoteItems: window.checkoutConfig && window.checkoutConfig.hasOwnProperty('quoteItemData')
            ? window.checkoutConfig['quoteItemData']
            : [],

        /**
         * @param {number} stepNumber
         */
        checkoutStepLoaded: function (stepNumber) {
            if (!this.gtmConfig['checkout_flow']['checkout_steps_reached']['enabled']) {
                return;
            }

            const data = {
                    'ecommerce': {
                        'checkout': {
                            'actionField': {
                                'step': stepNumber
                            }
                        },
                        'currencyCode': this.generalConfig['currency']['code']
                    }
                },
                products = [];

            if (stepNumber === this.checkoutStepsModel.shipping.number) {
                this.quoteItems.forEach(item => {
                    const pushData = {
                            'id': item.product_id,
                            'sku': item.sku,
                            'name': item.name,
                            'price': parseFloat(item.price),
                            'qty': item.qty
                        },
                        options = cartItemDataModel.getProductOptions(item.item_id);

                    if (Object.keys(options).length) {
                        pushData['options'] = options;
                    }

                    products.push(pushData);
                });

                if (!products.length) {
                    return;
                }

                data.ecommerce['products'] = products;
            }

            push(this.gtmConfig['checkout_flow']['checkout_steps_reached']['event_name'], data);
        },

        /**
         * Get swatch data using the 'window.acidSwatchData' array
         *
         * @param {Object} data
         * @param {string} swatchCode
         * @param {string} productId
         * @returns {string}
         */
        getSwatchData: function (data, swatchCode, productId) {
            const swatchItem = this.swatchData.filter(item => item['code'] === swatchCode)[0],
                swatchElement = data.form[0].querySelector(
                    '.swatch-attribute[data-attribute-code="' + swatchCode + '"]'
                );
            let optionId,
                optionItem;

            if (!swatchElement) {
                // if listing page
                const filtered = data.productInfo.filter(product => product.id === productId);

                // grab the last added element from 'data.productInfo' array
                filtered[filtered.length - 1].optionValues.forEach(optionValue => {
                    swatchItem['options'].forEach(swatchOption => {
                        if (optionValue === swatchOption['id']) {
                            optionId = optionValue;
                        }
                    });
                });
            } else {
                // if PDP
                optionId = swatchElement.dataset.optionSelected;
            }

            optionItem = swatchItem['options'].filter(option => option['id'] === optionId.toString())[0];

            return optionItem ? optionItem.label : '';
        },

        /**
         * @param {Object} data
         * @param {Boolean} isGrouped
         * @param {string} groupProductId
         * @returns {string}
         */
        getQtyFromDom: function (data, isGrouped = false, groupProductId) {
            let qtyElement;

            if (isGrouped) {
                qtyElement = data.form.find('input[name="super_group[' + groupProductId + ']"]');
            } else {
                qtyElement = data.form.find('#qty');
            }

            return qtyElement.length ? qtyElement.val() : '1';
        },

        /**
         * @param {Object} data
         * @return {number}
         */
        getBundlePriceFromDom: function (data) {
            const priceElement = data.form.find('.bundle-info .price');
            let price = '0';

            if (priceElement.length) {
                price = priceElement[0].innerText.replace(this.generalConfig['currency']['symbol'], '');
            }

            return parseFloat(price);
        },

        /**
         * @param {Object} event
         * @param {Object} data
         */
        processAddToCart: async function (event, data) {
            const productsPushData = [],
                isGrouped = !!data.form[0].querySelector('#super-product-table');
            let productId = '',
                qty,
                targetIdsArray;

            if (isGrouped) {
                /**
                 * grouped product can be added to the cart only from PDP,
                 * it's safe to grab 'productIds' property here, it won't contain previous added ids
                 */
                targetIdsArray = data['productIds'];
            } else {
                // simple or configurable product
                targetIdsArray = [data['productIds'][data['productIds'].length - 1]];
            }

            targetIdsArray.forEach(id => {
                Object.entries(this.productData).forEach(product => {
                    if (product[1].id === id) {
                        productId = product[0];
                    }
                });

                const productData = productDataModel.getProductDataById(productId);

                if (productData['min_price'] === 0) {
                    delete productData['min_price'];
                }

                if (productData['max_price'] === 0) {
                    delete productData['max_price'];
                }

                if (!productData || !data.form || productData['type'] === 'grouped') {
                    return;
                }

                if (productData['type'] === 'bundle') {
                    productData['price'] = this.getBundlePriceFromDom(data);

                    // if bundled product is added from a listing page, price will be 0, we do not push the event
                    if (!productData['price']) {
                        return;
                    }
                }

                qty = parseInt(this.getQtyFromDom(data, isGrouped, id), 10);

                if (!qty) {
                    return;
                }

                productData['qty'] = qty;

                if (this.productData[productId].type === 'configurable') {
                    if (!this.swatchData.length) {
                        this.swatchData = window.acidSwatchData ? window.acidSwatchData : [];
                    }

                    if (this.swatchData.length) {
                        productData['options'] = {};

                        this.swatchData.forEach(item => {
                            productData['options'][item['code']] = this.getSwatchData(data, item['code'], productId);
                        });
                    }
                }

                productsPushData.push(productData);
            });

            if (!productsPushData.length) {
                return;
            }

            push(this.gtmConfig['checkout_flow']['product_added_to_cart']['event_name'], {
                'ecommerce': {
                    'add': {
                        'products': productsPushData
                    },
                    'currencyCode': this.generalConfig['currency']['code']
                }
            });
        },

        /**
         * @param {Object} event
         * @param {Object} data
         * @param {boolean} getDataFromCartModel
         */
        processRemoveFromCart: function (event, data, getDataFromCartModel = true) {
            let productData;

            if (getDataFromCartModel) {
                const itemId = data['productData']['item_id'];

                productData = cartItemDataModel.getProductData(itemId);
                productData.qty = data.productData.qty;
            } else {
                productData = data;
            }

            productData.price = parseFloat(productData.price.toString());

            push(this.gtmConfig['checkout_flow']['product_removed_from_cart']['event_name'], {
                'ecommerce': {
                    'remove': {
                        'products': [productData]
                    },
                    'currencyCode': this.generalConfig['currency']['code']
                }
            });
        },

        /**
         * @param {string} serializedData
         * @return {object}
         */
        unserialize: function (serializedData) {
            const urlParams = new URLSearchParams(serializedData),
                unserializedData = {};

            for (const [key, value] of urlParams) {
                unserializedData[key] = value;
            }

            delete unserializedData['form_key'];
            return unserializedData;
        },

        /**
         * @param {Object} event
         * @param {Object} data
         */
        processCartItemQtyChanged: function (event, data) {
            const products = [];
            let productData;

            if (data.productData) {
                // updating qty from minicart
                const itemId = data.productData.item_id,
                    cartItem = cartItemDataModel.getOldQtyData().filter(item => item.item_id === itemId)[0];

                productData = cartItemDataModel.getProductData(itemId);
                productData.qty = parseInt(data.productData.qty, 10);
                productData.old_qty = parseInt(cartItem.qty, 10);

                products.push(productData);
            } else if (data.productsSerializedData) {
                // updating qty on cart page
                const unserialized = this.unserialize(data.productsSerializedData);

                Object.keys(unserialized).forEach(key => {
                    const itemId = key.replace('cart[', '').replace('][qty]', ''),
                        cartItem = this.cartCustomerData().items.filter(item => item.item_id === itemId)[0],
                        oldQty = parseInt(cartItem.qty, 10),
                        newQty = parseInt(unserialized[key], 10);

                    if (oldQty !== newQty) {
                        productData = cartItemDataModel.getProductData(cartItem.item_id);
                        productData.qty = newQty;
                        productData.old_qty = oldQty;

                        products.push(productData);
                    }
                });
            }

            push(this.gtmConfig['checkout_flow']['cart_item_qty_changed']['event_name'], {
                'ecommerce': {
                    'update': {
                        'products': products
                    },
                    'currencyCode': this.generalConfig['currency']['code']
                }
            });
        },

        bindAddToCartEvent: function () {
            $(document).on('ajax:addToCart', this.processAddToCart.bind(this));
        },

        bindRemoveFromCartEvent: function () {
            $(document).on('ajax:removeFromCart', this.processRemoveFromCart.bind(this));
        },

        bindCartItemQtyChangedEvent: function () {
            $(document).on('ajax:updateCartItemQty', this.processCartItemQtyChanged.bind(this));
        },

        init: function () {
            if (this.gtmConfig['checkout_flow']['product_added_to_cart']['enabled']) {
                this.bindAddToCartEvent();
            }

            if (this.gtmConfig['checkout_flow']['product_removed_from_cart']['enabled']) {
                this.bindRemoveFromCartEvent();
            }

            if (this.gtmConfig['checkout_flow']['cart_item_qty_changed']['enabled']) {
                cartItemDataModel.initOldQtyData();
                this.bindCartItemQtyChangedEvent();
            }
        }
    };
});
