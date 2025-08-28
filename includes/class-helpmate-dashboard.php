<?php

/**
 * The dashboard database handler for the HelpMate plugin.
 *
 * @link       https://rhapsodyplugins.com
 * @since      1.0.0
 *
 * @package    HelpMate
 * @subpackage HelpMate/includes
 * @author     Rhapsody Plugins <hello@rhapsodyplugins.com>
 */

// If this file is called directly, abort.
if ( ! defined( 'ABSPATH' ) ) exit;

class HelpMate_Dashboard
{

    /**
     * Get dashboard data with date filtering.
     *
     * @since 1.0.0
     * @param string $date_filter Optional. The date filter ('today', 'yesterday', 'last_week', 'last_month', 'last_year').
     * @return WP_REST_Response The dashboard data response.
     */
    public function get_dashboard_data($date_filter = 'today')
    {
        try {
            // Check if WooCommerce is active
            $woocommerce_active = class_exists('WooCommerce');

            // Calculate date ranges for current and previous periods
            $end_date = current_time('timestamp', true);
            $start_date = $this->get_start_date_for_filter($date_filter);
            $previous_start_date = $this->get_previous_period_start_date($date_filter, $start_date);

            // Get WooCommerce orders data for both periods
            $current_orders_data = $woocommerce_active ? $this->get_woocommerce_orders_data($start_date, $end_date) : ['total_orders' => 0, 'total_revenue' => 0, 'revenue_by_date' => []];
            $previous_orders_data = $woocommerce_active ? $this->get_woocommerce_orders_data($previous_start_date, $start_date) : ['total_orders' => 0, 'total_revenue' => 0, 'revenue_by_date' => []];

            // Get chat sessions data for both periods
            $current_chat_data = $this->get_chat_sessions_data($start_date, $end_date);
            $previous_chat_data = $this->get_chat_sessions_data($previous_start_date, $start_date);

            // Get sales data for both periods
            $current_sales_data = $woocommerce_active ? $this->get_sales_data($start_date, $end_date) : ['roi' => 0, 'aov' => 0];
            $previous_sales_data = $woocommerce_active ? $this->get_sales_data($previous_start_date, $start_date) : ['roi' => 0, 'aov' => 0];

            // Get statistics data for both periods
            $current_stats_data = $this->get_statistics_data($start_date, $end_date);
            $previous_stats_data = $this->get_statistics_data($previous_start_date, $start_date);

            // Calculate conversion rates
            $current_conversion_rate = 0;
            if ($current_chat_data['total_sessions'] > 0) {
                $current_conversion_rate = ($current_orders_data['total_orders'] / $current_chat_data['total_sessions']) * 100;
            }

            $previous_conversion_rate = 0;
            if ($previous_chat_data['total_sessions'] > 0) {
                $previous_conversion_rate = ($previous_orders_data['total_orders'] / $previous_chat_data['total_sessions']) * 100;
            }

            // Calculate percentage changes
            $calculate_percentage_change = function ($current, $previous) {
                if ($previous == 0)
                    return $current > 0 ? 100 : 0;
                return (($current - $previous) / $previous) * 100;
            };

            // Get chat analytics data for avg messages per session
            $current_chat_analytics = $this->get_chat_analytics_data($start_date, $end_date);
            $previous_chat_analytics = $this->get_chat_analytics_data($previous_start_date, $start_date);

            // Get ticket analytics data for avg resolution time
            $current_ticket_analytics = $this->get_ticket_analytics_data($start_date, $end_date);
            $previous_ticket_analytics = $this->get_ticket_analytics_data($previous_start_date, $start_date);

            $data = [
                'error' => false,
                'data' => [
                    'orders' => [
                        'total_orders' => $current_orders_data['total_orders'],
                        'total_chat_sessions' => $current_chat_data['total_sessions'],
                        'conversion_rate' => round($current_conversion_rate, 2),
                        'comparison' => [
                            'orders_change' => round($calculate_percentage_change(
                                $current_orders_data['total_orders'],
                                $previous_orders_data['total_orders']
                            ), 2),
                            'sessions_change' => round($calculate_percentage_change(
                                $current_chat_data['total_sessions'],
                                $previous_chat_data['total_sessions']
                            ), 2),
                            'conversion_change' => round($current_conversion_rate - $previous_conversion_rate, 2)
                        ]
                    ],
                    'sales' => [
                        'roi' => $current_sales_data['roi'],
                        'aov' => $current_sales_data['aov'],
                        'comparison' => [
                            'roi_change' => round($calculate_percentage_change(
                                $current_sales_data['roi'],
                                $previous_sales_data['roi']
                            ), 2),
                            'aov_change' => round($calculate_percentage_change(
                                $current_sales_data['aov'],
                                $previous_sales_data['aov']
                            ), 2)
                        ]
                    ],
                    'revenue' => [
                        'total' => $current_orders_data['total_revenue'],
                        'chart_data' => $current_orders_data['revenue_by_date'],
                        'comparison' => [
                            'revenue_change' => round($calculate_percentage_change(
                                $current_orders_data['total_revenue'],
                                $previous_orders_data['total_revenue']
                            ), 2)
                        ]
                    ],
                    'statistics' => [
                        'total_tickets' => $current_stats_data['total_tickets'],
                        'total_leads' => $current_stats_data['total_leads'],
                        'avg_messages_per_session' => $current_chat_analytics['avg_messages_per_session'],
                        'avg_resolution_time' => $current_ticket_analytics['avg_resolution_time'],
                        'comparison' => [
                            'tickets_change' => round($calculate_percentage_change(
                                $current_stats_data['total_tickets'],
                                $previous_stats_data['total_tickets']
                            ), 2),
                            'leads_change' => round($calculate_percentage_change(
                                $current_stats_data['total_leads'],
                                $previous_stats_data['total_leads']
                            ), 2),
                            'avg_messages_change' => round($calculate_percentage_change(
                                $current_chat_analytics['avg_messages_per_session'],
                                $previous_chat_analytics['avg_messages_per_session']
                            ), 2),
                            'resolution_time_change' => round($calculate_percentage_change(
                                $current_ticket_analytics['avg_resolution_time'],
                                $previous_ticket_analytics['avg_resolution_time']
                            ), 2)
                        ]
                    ],
                    'date_range' => [
                        'start' => gmdate('Y-m-d H:i:s', $start_date),
                        'end' => gmdate('Y-m-d H:i:s', $end_date),
                        'filter' => $date_filter
                    ]
                ]
            ];

            return new WP_REST_Response($data, 200);

        } catch (Exception $e) {
            return new WP_REST_Response([
                'error' => true,
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get start date based on filter.
     *
     * @since 1.0.0
     * @param string $filter The date filter.
     * @return int The start timestamp.
     */
    private function get_start_date_for_filter($filter)
    {
        $end_date = current_time('timestamp', true);
        switch ($filter) {
            case 'yesterday':
                return strtotime('yesterday', $end_date);
            case 'last_week':
                return strtotime('-1 week', $end_date);
            case 'last_month':
                return strtotime('-1 month', $end_date);
            case 'last_year':
                return strtotime('-1 year', $end_date);
            default: // today
                return strtotime('today', $end_date);
        }
    }

    /**
     * Get WooCommerce orders data.
     *
     * @since 1.0.0
     * @param int $start_date Start timestamp.
     * @param int $end_date End timestamp.
     * @return array Orders data.
     */
    private function get_woocommerce_orders_data($start_date, $end_date)
    {
        // Check if WooCommerce is active
        if (!class_exists('WooCommerce')) {
            return array(
                'total_orders' => 0,
                'total_revenue' => 0,
                'revenue_by_date' => array()
            );
        }

        $args = array(
            'status' => array('wc-completed'),
            'date_created' => gmdate('Y-m-d H:i:s', $start_date) . '...' . gmdate('Y-m-d H:i:s', $end_date),
            'return' => 'objects'
        );

        $orders = wc_get_orders($args);
        $total_revenue = 0;
        $revenue_by_date = array();

        foreach ($orders as $order) {
            $total_revenue += $order->get_total();
            $date = gmdate('Y-m-d', strtotime($order->get_date_created()));
            if (!isset($revenue_by_date[$date])) {
                $revenue_by_date[$date] = 0;
            }
            $revenue_by_date[$date] += $order->get_total();
        }

        return array(
            'total_orders' => count($orders),
            'total_revenue' => $total_revenue,
            'revenue_by_date' => $revenue_by_date
        );
    }

    /**
     * Get chat sessions data.
     *
     * @since 1.0.0
     * @param int $start_date Start timestamp.
     * @param int $end_date End timestamp.
     * @return array Chat sessions data.
     */
    private function get_chat_sessions_data(int $start_date, int $end_date)
    {
        global $wpdb;

        $total_sessions = $wpdb->get_var($wpdb->prepare( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            "SELECT COUNT(DISTINCT session_id) FROM {$wpdb->prefix}helpmate_chat_history WHERE timestamp BETWEEN %d AND %d",
            $start_date,
            $end_date
        ));

        return array(
            'total_sessions' => (int) $total_sessions
        );
    }

    /**
     * Get sales data.
     *
     * @since 1.0.0
     * @param int $start_date Start timestamp.
     * @param int $end_date End timestamp.
     * @return array Sales data.
     */
    private function get_sales_data($start_date, $end_date)
    {
        // Check if WooCommerce is active
        if (!class_exists('WooCommerce') || !is_plugin_active('woocommerce/woocommerce.php')) {
            return array(
                'roi' => 0,
                'aov' => 0
            );
        }

        $args = array(
            'status' => array('wc-completed'),
            'date_created' => gmdate('Y-m-d H:i:s', $start_date) . '...' . gmdate('Y-m-d H:i:s', $end_date),
            'return' => 'objects'
        );

        $orders = wc_get_orders($args);
        $total_revenue = 0;
        $total_orders = count($orders);

        foreach ($orders as $order) {
            $total_revenue += $order->get_total();
        }

        // Calculate AOV (Average Order Value)
        $aov = $total_orders > 0 ? $total_revenue / $total_orders : 0;

        // For ROI, we would need cost data which isn't available in the current structure
        // This is a placeholder calculation - you might want to adjust this based on your needs
        $roi = 0; // Placeholder for ROI calculation

        return array(
            'roi' => round($roi, 2),
            'aov' => round($aov, 2)
        );
    }

    /**
     * Get statistics data.
     *
     * @since 1.0.0
     * @param int $start_date Start timestamp.
     * @param int $end_date End timestamp.
     * @return array Statistics data.
     */
    private function get_statistics_data($start_date, $end_date)
    {
        global $wpdb;

        // Get total tickets
        $total_tickets = $wpdb->get_var($wpdb->prepare( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            "SELECT COUNT(*)
            FROM {$wpdb->prefix}helpmate_tickets
            WHERE timestamp BETWEEN %d AND %d",
            $start_date,
            $end_date
        ));

        // Get total leads
        $total_leads = $wpdb->get_var($wpdb->prepare( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            "SELECT COUNT(*)
            FROM {$wpdb->prefix}helpmate_leads
            WHERE timestamp BETWEEN %d AND %d",
            $start_date,
            $end_date
        ));

        return array(
            'total_tickets' => (int) $total_tickets,
            'total_leads' => (int) $total_leads
        );
    }

    /**
     * Get start date for the previous period based on the current filter.
     *
     * @since 1.0.0
     * @param string $filter The current date filter.
     * @param int $current_start_date The start date of the current period.
     * @return int The start timestamp for the previous period.
     */
    private function get_previous_period_start_date($filter, $current_start_date)
    {
        switch ($filter) {
            case 'yesterday':
                return strtotime('-1 day', $current_start_date);
            case 'last_week':
                return strtotime('-1 week', $current_start_date);
            case 'last_month':
                return strtotime('-1 month', $current_start_date);
            case 'last_year':
                return strtotime('-1 year', $current_start_date);
            default: // today
                return strtotime('-1 day', $current_start_date);
        }
    }

    /**
     * Get chat analytics data.
     *
     * @since 1.0.0
     * @param int $start_date Start timestamp.
     * @param int $end_date End timestamp.
     * @return array Chat analytics data.
     */
    private function get_chat_analytics_data($start_date, $end_date)
    {
        global $wpdb;

        // Get average messages per session
        $chat_stats = $wpdb->get_row($wpdb->prepare( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            "SELECT
                COUNT(DISTINCT session_id) as total_sessions,
                COUNT(*) as total_messages,
                AVG(message_count) as avg_messages_per_session
            FROM (
                SELECT session_id, COUNT(*) as message_count
                FROM {$wpdb->prefix}helpmate_chat_history
                WHERE timestamp BETWEEN %d AND %d
                GROUP BY session_id
            ) as session_counts",
            $start_date,
            $end_date
        ), ARRAY_A);

        return [
            'avg_messages_per_session' => round($chat_stats['avg_messages_per_session'] ?? 0, 2)
        ];
    }

    /**
     * Get ticket analytics data.
     *
     * @since 1.0.0
     * @param int $start_date Start timestamp.
     * @param int $end_date End timestamp.
     * @return array Ticket analytics data.
     */
    private function get_ticket_analytics_data($start_date, $end_date)
    {
        global $wpdb;

        // Get average resolution time
        $resolution_time = $wpdb->get_var($wpdb->prepare( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            "SELECT
                AVG(resolution_time) as avg_resolution_time
            FROM (
                SELECT
                    ticket_id,
                    MAX(timestamp) - MIN(timestamp) as resolution_time
                FROM {$wpdb->prefix}helpmate_tickets
                WHERE timestamp BETWEEN %d AND %d
                AND status = 'closed'
                GROUP BY ticket_id
            ) as resolution_times",
            $start_date,
            $end_date
        ));

        return [
            'avg_resolution_time' => round(($resolution_time ?? 0) / 3600, 2) // Convert to hours
        ];
    }
}