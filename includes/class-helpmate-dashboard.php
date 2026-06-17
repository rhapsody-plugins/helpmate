<?php

/**
 * The dashboard database handler for the Helpmate plugin.
 *
 * @link       https://rhapsodyplugins.com/helpmate
 * @since      1.0.0
 *
 * @package    Helpmate
 * @subpackage Helpmate/includes
 * @author     Rhapsody Plugins <hello@rhapsodyplugins.com>
 */

// If this file is called directly, abort.
if ( ! defined( 'ABSPATH' ) ) exit;

class Helpmate_Dashboard
{
    /**
     * The helpmate instance.
     *
     * @since 1.0.0
     * @access private
     * @var Helpmate $helpmate The helpmate instance.
     */
    private $helpmate;

    /**
     * Initialize the class and set its properties.
     *
     * @since 1.0.0
     * @param Helpmate $helpmate Optional. The helpmate instance.
     */
    public function __construct($helpmate = null)
    {
        $this->helpmate = $helpmate;
    }

    /**
     * Get dashboard data with date filtering.
     *
     * @since 1.0.0
     * @param string $date_filter Optional. The date filter ('today', 'yesterday', 'last_week', 'last_month', 'last_year').
     * @param int|null $user_id Optional. User ID for filtering (admin only).
     * @return WP_REST_Response The dashboard data response.
     */
    public function get_dashboard_data($date_filter = 'today', $user_id = null)
    {
        try {
            $active_providers = method_exists($this->helpmate, 'get_active_commerce_providers')
                ? $this->helpmate->get_active_commerce_providers()
                : array();
            if (empty($active_providers) && method_exists($this->helpmate, 'get_detected_commerce_providers')) {
                $detected = $this->helpmate->get_detected_commerce_providers();
                if (count($detected) === 1) {
                    $active_providers = $detected;
                }
            }
            $commerce_active = !empty($active_providers);

            // Calculate date ranges for current and previous periods
            $end_date = current_time('timestamp', true);
            $start_date = $this->get_start_date_for_filter($date_filter);
            $previous_start_date = $this->get_previous_period_start_date($date_filter, $start_date);

            // Get WooCommerce orders data for both periods (system-wide, no user filtering)
            $current_orders_data = $commerce_active ? $this->get_woocommerce_orders_data($start_date, $end_date) : ['total_orders' => 0, 'total_revenue' => 0, 'revenue_by_date' => []];
            $previous_orders_data = $commerce_active ? $this->get_woocommerce_orders_data($previous_start_date, $start_date) : ['total_orders' => 0, 'total_revenue' => 0, 'revenue_by_date' => []];

            // Get chat sessions data for both periods (filtered by user_id if provided)
            $current_chat_data = $this->get_chat_sessions_data($start_date, $end_date, $user_id);
            $previous_chat_data = $this->get_chat_sessions_data($previous_start_date, $start_date, $user_id);

            // Get sales data for both periods (system-wide, no user filtering)
            $current_sales_data = $commerce_active ? $this->get_sales_data($start_date, $end_date) : ['roi' => 0, 'aov' => 0];
            $previous_sales_data = $commerce_active ? $this->get_sales_data($previous_start_date, $start_date) : ['roi' => 0, 'aov' => 0];

            // Get statistics data for both periods (with optional user filtering)
            $current_stats_data = $this->get_statistics_data($start_date, $end_date, $user_id);
            $previous_stats_data = $this->get_statistics_data($previous_start_date, $start_date, $user_id);

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

            // Get chat analytics data for avg messages per session (filtered by user_id if provided)
            $current_chat_analytics = $this->get_chat_analytics_data($start_date, $end_date, $user_id);
            $previous_chat_analytics = $this->get_chat_analytics_data($previous_start_date, $start_date, $user_id);

            // Get ticket analytics data for avg resolution time (with optional user filtering)
            $current_ticket_analytics = $this->get_ticket_analytics_data($start_date, $end_date, $user_id);
            $previous_ticket_analytics = $this->get_ticket_analytics_data($previous_start_date, $start_date, $user_id);

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
                        'total_tickets_by_source' => $current_stats_data['total_tickets_by_source'],
                        'total_leads' => $current_stats_data['total_leads'],
                        'total_leads_by_source' => $current_stats_data['total_leads_by_source'],
                        'crm_conversion_rate' => $current_stats_data['crm_conversion_rate'],
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
                            'crm_conversion_rate_change' => round(
                                $current_stats_data['crm_conversion_rate'] - $previous_stats_data['crm_conversion_rate'],
                                2
                            ),
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
        $provider = method_exists($this->helpmate, 'get_primary_commerce_provider')
            ? $this->helpmate->get_primary_commerce_provider()
            : '';
        if ($provider === '') {
            return array(
                'total_orders' => 0,
                'total_revenue' => 0,
                'revenue_by_date' => array()
            );
        }

        if ($provider === 'easy_digital_downloads' && function_exists('edd_get_orders')) {
            $orders = edd_get_orders([
                'number' => 1000,
                'status' => 'complete',
                'date_query' => [
                    'after' => gmdate('Y-m-d H:i:s', $start_date),
                    'before' => gmdate('Y-m-d H:i:s', $end_date),
                ],
            ]);
            $total_revenue = 0;
            $revenue_by_date = array();
            foreach ((array) $orders as $order) {
                $order_total = (float) ($order->total ?? 0);
                $total_revenue += $order_total;
                $date = !empty($order->date_created) ? gmdate('Y-m-d', strtotime((string) $order->date_created)) : gmdate('Y-m-d');
                if (!isset($revenue_by_date[$date])) {
                    $revenue_by_date[$date] = 0;
                }
                $revenue_by_date[$date] += $order_total;
            }
            return [
                'total_orders' => is_array($orders) ? count($orders) : 0,
                'total_revenue' => $total_revenue,
                'revenue_by_date' => $revenue_by_date,
            ];
        }

        if ($provider === 'surecart') {
            return $this->get_surecart_dashboard_orders_aggregate($start_date, $end_date);
        }

        if (!function_exists('wc_get_orders')) {
            return array(
                'total_orders' => 0,
                'total_revenue' => 0,
                'revenue_by_date' => array(),
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
     * SureCart orders aggregate for dashboard (paid/processing in UTC window).
     *
     * @param int $start_date Start Unix timestamp (GMT).
     * @param int $end_date   End Unix timestamp (GMT).
     * @return array{total_orders:int,total_revenue:float,revenue_by_date:array<string,float>}
     */
    private function get_surecart_dashboard_orders_aggregate($start_date, $end_date)
    {
        if (!class_exists('\SureCart\Models\Order')) {
            return array(
                'total_orders' => 0,
                'total_revenue' => 0,
                'revenue_by_date' => array(),
            );
        }

        $start_ts = (int) $start_date;
        $end_ts = (int) $end_date;
        $total_revenue = 0.0;
        $revenue_by_date = array();
        $count = 0;

        try {
            $page = 1;
            $per_page = 100;
            $max_pages = 40;

            while ($page <= $max_pages) {
                $query = \SureCart\Models\Order::where(
                    array(
                        'status' => array('paid', 'processing'),
                    )
                )->with(array('checkout'));

                $page_result = $query->paginate(
                    array(
                        'per_page' => $per_page,
                        'page' => $page,
                    )
                );

                if (is_wp_error($page_result)) {
                    break;
                }

                $orders_list = array();
                if (is_object($page_result)) {
                    $raw = null;
                    if (method_exists($page_result, 'getAttribute')) {
                        $raw = $page_result->getAttribute('data');
                    }
                    if (!is_array($raw)) {
                        $raw = $page_result->data;
                    }
                    if (is_array($raw)) {
                        $orders_list = $raw;
                    }
                } elseif (is_array($page_result)) {
                    $orders_list = $page_result;
                }

                if (empty($orders_list)) {
                    break;
                }

                foreach ($orders_list as $order) {
                    if (!is_object($order)) {
                        continue;
                    }
                    $ts = !empty($order->created_at) ? (int) $order->created_at : 0;
                    if ($ts < $start_ts || $ts > $end_ts) {
                        continue;
                    }
                    $checkout = (isset($order->checkout) && is_object($order->checkout)) ? $order->checkout : null;
                    $minor = $checkout && isset($checkout->total_amount) ? (int) $checkout->total_amount : 0;
                    $zd = $checkout && !empty($checkout->is_zero_decimal);
                    $amount = $zd ? (float) $minor : (float) round($minor / 100, 2);
                    $total_revenue += $amount;
                    ++$count;
                    $d = gmdate('Y-m-d', $ts);
                    if (!isset($revenue_by_date[$d])) {
                        $revenue_by_date[$d] = 0;
                    }
                    $revenue_by_date[$d] += $amount;
                }

                if (count($orders_list) < $per_page) {
                    break;
                }
                ++$page;
            }
        } catch (\Throwable $e) {
            return array(
                'total_orders' => 0,
                'total_revenue' => 0,
                'revenue_by_date' => array(),
            );
        }

        return array(
            'total_orders' => $count,
            'total_revenue' => $total_revenue,
            'revenue_by_date' => $revenue_by_date,
        );
    }

    /**
     * Get chat sessions data.
     *
     * @since 1.0.0
     * @param int $start_date Start timestamp.
     * @param int $end_date End timestamp.
     * @param int|null $user_id Optional user ID filter.
     * @return array Chat sessions data.
     */
    private function get_chat_sessions_data(int $start_date, int $end_date, $user_id = null)
    {
        global $wpdb;

        if ($user_id) {
            // Get session_ids where user participated (from conversation_participants)
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
            $session_ids = $wpdb->get_col($wpdb->prepare(
                "SELECT DISTINCT conversation_id
                FROM {$wpdb->prefix}helpmate_conversation_participants
                WHERE conversation_type = 'website'
                AND user_id = %d
                AND UNIX_TIMESTAMP(joined_at) BETWEEN %d AND %d",
                $user_id,
                $start_date,
                $end_date
            ));

            if (empty($session_ids)) {
                return array('total_sessions' => 0);
            }

            // Count sessions from chat_history where session_id IN (...)
            $placeholders = implode(',', array_fill(0, count($session_ids), '%s'));
            $query = "SELECT COUNT(DISTINCT session_id)
                FROM {$wpdb->prefix}helpmate_chat_history
                WHERE session_id IN ($placeholders)
                AND timestamp BETWEEN %d AND %d";
            $prepare_params = array_merge($session_ids, [$start_date, $end_date]);
            // phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare -- Direct query necessary; table name is safe; dynamic IN clause; query variable is prepared with spread operator
            $total_sessions = $wpdb->get_var($wpdb->prepare($query, ...$prepare_params));
            // phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
        } else {
            // System-wide: count all sessions
            $total_sessions = $wpdb->get_var($wpdb->prepare( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                "SELECT COUNT(DISTINCT session_id) FROM {$wpdb->prefix}helpmate_chat_history WHERE timestamp BETWEEN %d AND %d",
                $start_date,
                $end_date
            ));
        }

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
        $provider = method_exists($this->helpmate, 'get_primary_commerce_provider')
            ? $this->helpmate->get_primary_commerce_provider()
            : '';
        if ($provider === '') {
            return array(
                'roi' => 0,
                'aov' => 0
            );
        }

        if ($provider === 'easy_digital_downloads' && function_exists('edd_get_orders')) {
            $orders = edd_get_orders([
                'number' => 1000,
                'status' => 'complete',
                'date_query' => [
                    'after' => gmdate('Y-m-d H:i:s', $start_date),
                    'before' => gmdate('Y-m-d H:i:s', $end_date),
                ],
            ]);
            $total_revenue = 0;
            $order_count = 0;
            foreach ((array) $orders as $order) {
                $total_revenue += (float) ($order->total ?? 0);
                $order_count++;
            }
            $aov = $order_count > 0 ? $total_revenue / $order_count : 0;
            return ['roi' => 0, 'aov' => $aov];
        }

        if ($provider === 'surecart') {
            $agg = $this->get_surecart_dashboard_orders_aggregate($start_date, $end_date);
            $count = (int) ($agg['total_orders'] ?? 0);
            $rev = (float) ($agg['total_revenue'] ?? 0);
            $aov = $count > 0 ? $rev / $count : 0;
            return array('roi' => 0, 'aov' => round($aov, 2));
        }

        if (!function_exists('wc_get_orders')) {
            return array('roi' => 0, 'aov' => 0);
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
     * @param int|null $user_id Optional user ID filter.
     * @return array Statistics data.
     */
    private function get_statistics_data($start_date, $end_date, $user_id = null)
    {
        global $wpdb;

        // Get total tickets (filtered by user_id if provided)
        if ($user_id) {
            $total_tickets = $wpdb->get_var($wpdb->prepare( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                "SELECT COUNT(*)
                FROM {$wpdb->prefix}helpmate_tickets
                WHERE timestamp BETWEEN %d AND %d
                AND user_id = %d",
                $start_date,
                $end_date,
                $user_id
            ));
        } else {
            $total_tickets = $wpdb->get_var($wpdb->prepare( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                "SELECT COUNT(*)
                FROM {$wpdb->prefix}helpmate_tickets
                WHERE timestamp BETWEEN %d AND %d",
                $start_date,
                $end_date
            ));
        }

        // Get tickets by source (only when not filtering by user)
        $tickets_by_source_map = [];
        if (!$user_id) {
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
            $tickets_by_source = $wpdb->get_results($wpdb->prepare(
                "SELECT source, COUNT(*) as count
                FROM {$wpdb->prefix}helpmate_tickets
                WHERE timestamp BETWEEN %d AND %d
                GROUP BY source",
                $start_date,
                $end_date
            ), ARRAY_A);

            foreach ($tickets_by_source as $row) {
                $source = $row['source'] ?? 'unknown';
                $tickets_by_source_map[$source] = (int) $row['count'];
            }
        }

        // Get total leads (leads table doesn't have user_id, so no filtering)
        $total_leads = $wpdb->get_var($wpdb->prepare( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            "SELECT COUNT(*)
            FROM {$wpdb->prefix}helpmate_leads
            WHERE timestamp BETWEEN %d AND %d",
            $start_date,
            $end_date
        ));

        // Get leads by source (only when not filtering by user)
        $leads_by_source_map = [];
        if (!$user_id) {
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
            $leads_by_source = $wpdb->get_results($wpdb->prepare(
                "SELECT source, COUNT(*) as count
                FROM {$wpdb->prefix}helpmate_leads
                WHERE timestamp BETWEEN %d AND %d
                GROUP BY source",
                $start_date,
                $end_date
            ), ARRAY_A);

            foreach ($leads_by_source as $row) {
                $source = $row['source'] ?? 'unknown';
                $leads_by_source_map[$source] = (int) $row['count'];
            }
        }

        // Get CRM conversion rate (leads with contact_id)
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
        $converted_leads = $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*)
            FROM {$wpdb->prefix}helpmate_leads
            WHERE timestamp BETWEEN %d AND %d
            AND contact_id IS NOT NULL",
            $start_date,
            $end_date
        ));

        $crm_conversion_rate = $total_leads > 0 ? (($converted_leads / $total_leads) * 100) : 0;

        return array(
            'total_tickets' => (int) $total_tickets,
            'total_tickets_by_source' => $tickets_by_source_map,
            'total_leads' => (int) $total_leads,
            'total_leads_by_source' => $leads_by_source_map,
            'crm_conversion_rate' => round($crm_conversion_rate, 2)
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
     * @param int|null $user_id Optional user ID filter.
     * @return array Chat analytics data.
     */
    private function get_chat_analytics_data($start_date, $end_date, $user_id = null)
    {
        global $wpdb;

        if ($user_id) {
            // Get session_ids where user participated
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
            $session_ids = $wpdb->get_col($wpdb->prepare(
                "SELECT DISTINCT conversation_id
                FROM {$wpdb->prefix}helpmate_conversation_participants
                WHERE conversation_type = 'website'
                AND user_id = %d
                AND UNIX_TIMESTAMP(joined_at) BETWEEN %d AND %d",
                $user_id,
                $start_date,
                $end_date
            ));

            if (empty($session_ids)) {
                return ['avg_messages_per_session' => 0];
            }

            // Get average messages per session for user's sessions
            $placeholders = implode(',', array_fill(0, count($session_ids), '%s'));
            $query = "SELECT
                    COUNT(DISTINCT session_id) as total_sessions,
                    COUNT(*) as total_messages,
                    AVG(message_count) as avg_messages_per_session
                FROM (
                    SELECT session_id, COUNT(*) as message_count
                    FROM {$wpdb->prefix}helpmate_chat_history
                    WHERE session_id IN ($placeholders)
                    AND timestamp BETWEEN %d AND %d
                    GROUP BY session_id
                ) as session_counts";
            $prepare_params = array_merge($session_ids, [$start_date, $end_date]);
            // phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare -- Direct query necessary; table name is safe; dynamic IN clause; query variable is prepared with spread operator
            $chat_stats = $wpdb->get_row($wpdb->prepare($query, ...$prepare_params), ARRAY_A);
            // phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
        } else {
            // System-wide: get average messages per session for all sessions
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
        }

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
     * @param int|null $user_id Optional user ID filter.
     * @return array Ticket analytics data.
     */
    private function get_ticket_analytics_data($start_date, $end_date, $user_id = null)
    {
        global $wpdb;

        // Build WHERE clause based on user_id filter
        // Get average resolution time - support both 'closed' and 'resolved' status
        // Use explicit query paths instead of dynamic WHERE clause to avoid UnescapedDBParameter warnings
        if ($user_id) {
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
            $resolution_time = $wpdb->get_var($wpdb->prepare(
                "SELECT
                    AVG(resolution_time) as avg_resolution_time
                FROM (
                    SELECT
                        ticket_id,
                        MAX(timestamp) - MIN(timestamp) as resolution_time
                    FROM {$wpdb->prefix}helpmate_tickets
                    WHERE timestamp BETWEEN %d AND %d
                    AND status IN ('closed', 'resolved')
                    AND user_id = %d
                    GROUP BY ticket_id
                ) as resolution_times", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                $start_date,
                $end_date,
                $user_id
            ));
        } else {
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
            $resolution_time = $wpdb->get_var($wpdb->prepare(
                "SELECT
                    AVG(resolution_time) as avg_resolution_time
                FROM (
                    SELECT
                        ticket_id,
                        MAX(timestamp) - MIN(timestamp) as resolution_time
                    FROM {$wpdb->prefix}helpmate_tickets
                    WHERE timestamp BETWEEN %d AND %d
                    AND status IN ('closed', 'resolved')
                    GROUP BY ticket_id
                ) as resolution_times", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                $start_date,
                $end_date
            ));
        }

        return [
            'avg_resolution_time' => round(($resolution_time ?? 0) / 3600, 2) // Convert to hours
        ];
    }

    /**
     * Get dashboard overview data.
     *
     * @since 1.0.0
     * @return WP_REST_Response The dashboard overview data response.
     */
    public function get_dashboard_overview()
    {
        try {
            global $wpdb;

            // Get total chat sessions (all time, excluding debug sessions)
            $total_chats = $wpdb->get_var( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                "SELECT COUNT(DISTINCT session_id)
                FROM {$wpdb->prefix}helpmate_chat_history
                WHERE session_id NOT IN (
                    SELECT DISTINCT session_id
                    FROM {$wpdb->prefix}helpmate_chat_history
                    WHERE JSON_EXTRACT(metadata, '$.debug') = true
                )"
            );

            // Get total contacts count
            $total_contacts = $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->prefix}helpmate_crm_contacts"); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching

            // Get employee of the month (top performer from current month)
            $employee_of_month = null;
            if ($this->helpmate) {
                $crm_analytics = $this->helpmate->get_crm_analytics();
                // Get current month date range
                $end_date = current_time('timestamp', true);
                $start_date = strtotime('first day of this month', $end_date);

                // Get date range array for team performance
                $date_range = [
                    'start' => $start_date,
                    'end' => $end_date,
                    'start_mysql' => gmdate('Y-m-d H:i:s', $start_date),
                    'end_mysql' => gmdate('Y-m-d H:i:s', $end_date)
                ];
                $previous_range = [
                    'start' => strtotime('first day of last month', $end_date),
                    'end' => strtotime('last day of last month', $end_date),
                    'start_mysql' => gmdate('Y-m-d H:i:s', strtotime('first day of last month', $end_date)),
                    'end_mysql' => gmdate('Y-m-d H:i:s', strtotime('last day of last month', $end_date))
                ];

                $team_performance = $crm_analytics->get_team_performance($date_range, $previous_range);

                if (!empty($team_performance)) {
                    // Calculate score for each member and find top performer
                    $top_performer = null;
                    $top_score = -1;

                    foreach ($team_performance as $member) {
                        $score = ($member['tasks_completed'] ?? 0) +
                                 ($member['tickets_resolved'] ?? 0) +
                                 ($member['contacts_created'] ?? 0);

                        if ($score > $top_score) {
                            $top_score = $score;
                            $top_performer = $member;
                        }
                    }

                    // Assign employee of the month if we have a top performer (even if score is 0)
                    if ($top_performer !== null) {
                        $employee_of_month = [
                            'user_id' => $top_performer['user_id'],
                            'display_name' => $top_performer['display_name'],
                            'email' => $top_performer['email'],
                            'score' => $top_score
                        ];
                    }
                }
            }

            // Get total knowledge bases (documents count)
            $total_knowledge_bases = 0;
            if ($this->helpmate) {
                $document_handler = $this->helpmate->get_document_handler();
                $total_knowledge_bases = $document_handler ? $document_handler->all_documents_count() : 0;
            }

            $data = [
                'error' => false,
                'data' => [
                    'total_chats' => (int) $total_chats,
                    'total_contacts' => (int) $total_contacts,
                    'employee_of_month' => $employee_of_month,
                    'total_knowledge_bases' => (int) $total_knowledge_bases
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
}