// noinspection RedundantIfStatementJS, JSUnresolvedReference

/**
 * Copyright © Acid Unit (https://acid.7prism.com). All rights reserved.
 * See LICENSE file for license details.
 */

define([
    './../action/push',
    './../model/page-handle',
    './../model/page-data'
], function (
    push,
    handleModel,
    pageDataModel
) {
    'use strict';

    return {
        gtmConfig: window.acidGtmConfig ? window.acidGtmConfig : {},
        generalConfig: window.acidGeneralConfig ? window.acidGeneralConfig : {},

        /**
         * @return {boolean}
         */
        isActive: function () {
            if (!this.gtmConfig['page_load'] || !this.gtmConfig['page_load']['enabled']) {
                return false;
            }

            const allPageHandlesArray = handleModel.getAllPageHandles(),
                handlesListInvertedBehavior = this.gtmConfig['page_load']['handles_list_inverted'];
            let handlesListHasCurrentHandleCode = false;

            this.gtmConfig['page_load']['handles_list'].split('\r\n').forEach(handle => {
                if (allPageHandlesArray.includes(handle)) {
                    handlesListHasCurrentHandleCode = true;
                }
            });

            // if current page handle is in the list with excluded option
            if (!handlesListInvertedBehavior && handlesListHasCurrentHandleCode) {
                return false;
            }

            // if current page handle is NOT in the list with included option
            if (handlesListInvertedBehavior && !handlesListHasCurrentHandleCode) {
                return false;
            }

            return true;
        },

        successOrder: function () {
            if (!this.isActive()) {
                return;
            }

            if (!this.gtmConfig['checkout_flow']['purchase_done']['enabled']) {
                return;
            }

            const pageData = pageDataModel.getPageData();

            push(this.gtmConfig['checkout_flow']['purchase_done']['event_name'], {
                'ecommerce': {
                    'purchase': {
                        'actionField': pageData['provider']['order_data'],
                        'products': pageData['provider']['products']
                    },
                    'currencyCode': this.generalConfig['currency']['code']
                }
            });
        },

        pdp: function () {
            if (!this.isActive()) {
                return;
            }

            const pageData = pageDataModel.getPageData();

            push(this.gtmConfig['page_load']['pdp_load_event_name'], {
                'ecommerce': {
                    'detail': {
                        'products': pageData['provider']
                    },
                    'currencyCode': this.generalConfig['currency']['code']
                }
            });
        },

        plp: function () {
            if (!this.isActive()) {
                return;
            }

            const pageData = pageDataModel.getPageData();

            push(this.gtmConfig['page_load']['plp_load_event_name'], {
                'ecommerce': {
                    'impressions': pageData['provider'],
                    'currencyCode': this.generalConfig['currency']['code']
                }
            });
        },

        searchResultsPage: function () {
            if (!this.isActive()) {
                return;
            }

            const pageData = pageDataModel.getPageData();

            push(this.gtmConfig['page_load']['search_results_page_load_event_name'], {
                'ecommerce': {
                    'search_result': pageData['provider'],
                    'currencyCode': this.generalConfig['currency']['code']
                },
                'search_query': new URLSearchParams(document.location.search).get('q')
            });
        },

        /**
         * @return {boolean}
         */
        customPage: function () {
            const customPages = JSON.parse(this.gtmConfig['page_load']['custom_pages'] || 'null');
            let isCustomPage = false;

            Object.keys(customPages).forEach(key => {
                if (customPages[key]['enabled'] !== '1') {
                    return;
                }

                if (window.location.href.includes(customPages[key]['url'])) {
                    isCustomPage = true;

                    push(customPages[key]['event'], {
                        'page': 'custom'
                    });
                }
            });

            return isCustomPage;
        },

        default: function () {
            if (!this.isActive()) {
                return;
            }

            if (this.customPage()) {
                return;
            }

            const currentPageName = handleModel.getCurrentPageName(),
                eventName = this.gtmConfig['page_load']['event_name'],
                h1 = document.querySelector('h1'),
                pageData = pageDataModel.getPageData(),
                pushData = {};

            if (this.gtmConfig['page_load']['user_type_enabled']) {
                pushData['user_type'] = pageData['user_type'];
            }

            if (h1.innerText) {
                pushData['title'] = h1.innerText;
            }

            if (currentPageName) {
                pushData['page'] = currentPageName;
            } else if (document.querySelector('body').classList.value.split(' ').includes('account')) {
                /**
                 * Customer account can have different page handles,
                 * the solution to check body classes is simpler to write and support in this case
                 */
                delete pushData['user_type'];
                pushData['page'] = handleModel.handles.customerAccountPage.name;
            } else {
                pushData['page'] = 'other';
            }

            push(eventName, pushData);
        }
    };
});
