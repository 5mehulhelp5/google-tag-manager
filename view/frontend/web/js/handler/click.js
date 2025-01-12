/**
 * Copyright © Acid Unit (https://acid.7prism.com). All rights reserved.
 * See LICENSE file for license details.
 */

define([
    './../action/push',
    './../model/page-handle',
    './../model/product-data',
    './../model/menu-data'
], function (
    push,
    handleModel,
    productDataModel,
    menuDataModel
) {
    'use strict';

    return {
        gtmConfig: window.acidGtmConfig ? window.acidGtmConfig : {},

        model: {
            product: {
                selectors: [
                    'a.product-item-photo',
                    'a.product-item-link'
                ],
                productItemSelector: '.product-item'
            }
        },

        /**
         * @param {object} event
         */
        processProductClick: function (event) {
            const product = event.target.closest(this.model.product.productItemSelector),
                productData = productDataModel.getData(product),
                eventName = this.gtmConfig['click']['product']['event_name'];

            if (!Object.keys(productData).length) {
                return;
            }

            push(eventName, {
                'ecommerce': {
                    'click': {
                        'actionField': {'list': handleModel.getCurrentPageName()},
                        'products': [productData]
                    }
                }
            });
        },

        bindProductClick: function () {
            const productsSelector = this.model.product.selectors.join(', ');

            if (!productsSelector.length) {
                return;
            }

            document.querySelectorAll(productsSelector).forEach(productElement =>
                productElement.addEventListener('click', event => {
                    this.processProductClick(event);
                })
            );
        },

        /**
         * @param {object} event
         */
        processMenuItemClick: function (event) {
            const target = event.target,
                menuItemHref = target.getAttribute('href'),
                menuItemData = menuDataModel.getMenuItemData(menuItemHref),
                eventName = this.gtmConfig['click']['menu_item']['event_name'];

            if (!Object.values(menuItemData).length) {
                return;
            }

            push(eventName, {
                'ecommerce': {
                    'click': {
                        'menuItem': menuItemData['name'],
                        'path': menuItemData['path']
                    }
                }
            });
        },

        bindMenuItemClick: function () {
            const menuItemsSelector = menuDataModel.menuItem.selectors.join(', ');

            if (!menuItemsSelector.length) {
                return;
            }

            document.querySelectorAll(menuItemsSelector).forEach(menuItemElement =>
                menuItemElement.addEventListener('click', event => {
                    this.processMenuItemClick(event);
                })
            );
        },

        init: function () {
            if (this.gtmConfig['click']['product']['enabled']) {
                this.bindProductClick();
            }

            if (this.gtmConfig['click']['menu_item']['enabled']) {
                this.bindMenuItemClick();
            }
        }
    };
});
