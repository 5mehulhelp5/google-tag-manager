<?php
/**
 * Copyright © Acid Unit (https://acid.7prism.com). All rights reserved.
 * See LICENSE file for license details.
 */

declare(strict_types=1);

namespace AcidUnit\GoogleTagManager\Model\Customer;

use AcidUnit\GoogleTagManager\Model\Config;
use AcidUnit\GoogleTagManager\Model\GtmEvents;
use Magento\Customer\Model\Session;
use Magento\Framework\Message\ManagerInterface;

/**
 * @SuppressWarnings(PHPMD.CookieAndSessionMisuse)
 */
class LoginData
{
    /**
     * @param Session $session
     * @param ManagerInterface $messageManager
     * @param Config $config
     */
    public function __construct(
        private readonly Session          $session,
        private readonly ManagerInterface $messageManager,
        private readonly Config           $config
    ) {
    }

    /**
     * Set customer data
     *
     * @return void
     * @noinspection PhpUndefinedMethodInspection
     */
    public function setCustomerData(): void
    {
        if (!$this->config->isGtmCustomerSessionLoginEnabled()) {
            return;
        }

        $customerId = $this->session->getCustomerId();

        if ($customerId) {
            $this->session->setGtmData([ // @phpstan-ignore-line
                'gtm_event' => [
                    'event' => GtmEvents::LOGIN_SUCCESSFUL,
                    'data' => [
                        'customerId' => $customerId
                    ]
                ]
            ]);

            return;
        }

        if (!$this->config->isGtmCustomerSessionLoginFailedEnabled()) {
            return;
        }

        $message = $this->messageManager->getMessages()->getLastAddedMessage();

        $this->session->setGtmData([ // @phpstan-ignore-line
            'gtm_event' => [
                'event' => GtmEvents::LOGIN_FAILED,
                'data' => [
                    'message' => $message ? $message->getText() : ''
                ]
            ]
        ]);
    }
}
