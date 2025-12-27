import LoginLog from '../MODELS/LoginLog.model.js';
import useragent from 'useragent';
import geoip from 'geoip-lite';

/**
 * Extract device info from User-Agent string
 */
export const parseUserAgent = (userAgentString) => {
    if (!userAgentString) {
        return {
            browser: { name: 'Unknown', version: 'Unknown' },
            os: { name: 'Unknown', version: 'Unknown' },
            device: 'desktop',
            deviceName: 'Unknown Device'
        };
    }

    try {
        const ua = useragent.parse(userAgentString);

        // Detect device type
        let deviceType = 'desktop';
        if (ua.isMobile) deviceType = 'mobile';
        if (ua.isTablet) deviceType = 'tablet';

        // Get device name - with proper fallback
        let deviceName = 'Unknown Device';

        if (ua.device && ua.device.family && ua.device.family !== 'Other') {
            deviceName = ua.device.family;
        } else if (deviceType === 'mobile') {
            deviceName = 'Mobile Device';
        } else if (deviceType === 'tablet') {
            deviceName = 'Tablet';
        } else {
            deviceName = 'Desktop';
        }

        // ✅ CORRECT CODE:
        // ✅ FIXED - Get browser name - clean (without version)
        let browserName = 'Unknown';
        if (ua.family && ua.family !== 'Other') {
            browserName = ua.family;  // Just the name, not the full string
        } else {
            browserName = 'Unknown';
        }


        return {
            browser: {
                name: browserName || 'Unknown',
                version: ua.major || 'Unknown'
            },
            os: {
                name: ua.os?.family || 'Unknown',
                version: ua.os?.major || 'Unknown'
            },
            device: deviceType,
            deviceName: deviceName,
            userAgent: userAgentString
        };
    } catch (error) {
        console.error('[LOGIN_LOG] Error parsing user agent:', error);
        return {
            browser: { name: 'Unknown', version: 'Unknown' },
            os: { name: 'Unknown', version: 'Unknown' },
            device: 'desktop',
            deviceName: 'Unknown Device',
            userAgent: userAgentString
        };
    }
};

/**
 * Get location from IP address
 * Returns null for localhost - that's expected behavior
 */
export const getLocationFromIP = (ipAddress) => {
    try {
        // Skip localhost - no geolocation data available
        if (ipAddress === '127.0.0.1' || ipAddress === '::1' || ipAddress === 'localhost') {
            return {
                country: 'Local',
                city: 'Localhost',
                region: 'Local',
                timezone: 'Local',
                latitude: null,
                longitude: null,
            };
        }

        // Clean IP address (remove extra spaces/ports)
        const cleanIP = ipAddress.split(':')[0].trim();

        if (!cleanIP || cleanIP === '127.0.0.1') {
            return {
                country: 'Local',
                city: 'Localhost',
                region: 'Local',
                timezone: 'Local',
                latitude: null,
                longitude: null,
            };
        }

        const geo = geoip.lookup(cleanIP);

        if (!geo) {
            console.warn('[LOGIN_LOG] Geoip lookup returned null for IP:', cleanIP);
            return {
                country: 'Unknown',
                city: 'Unknown',
                region: 'Unknown',
                timezone: 'Unknown',
                latitude: null,
                longitude: null,
            };
        }

        // Safely extract coordinates
        let latitude = null;
        let longitude = null;

        if (geo.ll && Array.isArray(geo.ll) && geo.ll.length === 2) {
            latitude = geo.ll[0];
            longitude = geo.ll[1];
        }

        return {
            country: geo.country || 'Unknown',
            city: geo.city || 'Unknown',
            region: geo.region || 'Unknown',
            timezone: geo.timezone || 'Unknown',
            latitude: latitude,
            longitude: longitude,
        };
    } catch (error) {
        console.error('[LOGIN_LOG] Error getting location:', error);
        return {
            country: 'Unknown',
            city: 'Unknown',
            region: 'Unknown',
            timezone: 'Unknown',
            latitude: null,
            longitude: null,
        };
    }
};

/**
 * Get IP address from request
 */
export const getClientIP = (req) => {
    let ip;

    // Check multiple headers (proxy, load balancer, etc)
    if (req.headers['x-forwarded-for']) {
        ip = req.headers['x-forwarded-for'].split(',')[0].trim();
    } else if (req.headers['x-real-ip']) {
        ip = req.headers['x-real-ip'];
    } else if (req.headers['cf-connecting-ip']) {
        ip = req.headers['cf-connecting-ip'];
    } else if (req.connection?.remoteAddress) {
        ip = req.connection.remoteAddress;
    } else if (req.socket?.remoteAddress) {
        ip = req.socket.remoteAddress;
    } else if (req.connection?.socket?.remoteAddress) {
        ip = req.connection.socket.remoteAddress;
    } else {
        ip = 'unknown';
    }

    // Handle IPv6 localhost
    if (ip === '::1' || ip === '::ffff:127.0.0.1') {
        return '127.0.0.1';
    }

    // Clean up IPv6 mapped IPv4
    if (ip?.startsWith('::ffff:')) {
        return ip.slice(7);
    }

    return ip || 'unknown';
};

/**
 * Create login log
 */
export const createLoginLog = async (userId, req, status = 'success', failureReason = null) => {
    try {
        const ipAddress = getClientIP(req);
        const userAgentString = req.headers['user-agent'] || '';

        // Parse device info
        const deviceInfo = parseUserAgent(userAgentString);

        // Get location - will return proper structure even for localhost
        const location = getLocationFromIP(ipAddress);

        console.log('[LOGIN_LOG] Creating login log with:', {
            userId,
            status,
            ipAddress,
            browser: deviceInfo.browser.name,
            os: deviceInfo.os.name,
            device: deviceInfo.device,
            deviceName: deviceInfo.deviceName,
            location: location
        });

        const loginLog = new LoginLog({
            userId,
            status,
            ipAddress,
            browser: {
                name: deviceInfo.browser.name,
                version: deviceInfo.browser.version
            },
            os: {
                name: deviceInfo.os.name,
                version: deviceInfo.os.version
            },
            device: deviceInfo.device,
            deviceName: deviceInfo.deviceName, // ✅ Now properly set
            userAgent: userAgentString,
            location: location, // ✅ Now has proper structure
            loginMethod: req.loginMethod || 'email',
            failureReason,
            loginTime: new Date(),
        });

        const savedLog = await loginLog.save();
        console.log('[LOGIN_LOG] Login recorded successfully:', savedLog._id);

        return savedLog;
    } catch (error) {
        console.error('[LOGIN_LOG] Error creating login log:', error);
        // Don't throw - logging should not break login flow
        return null;
    }
};

/**
 * Create failed login log
 */
export const logFailedLogin = async (email, req, reason = 'Invalid credentials') => {
    try {
        const ipAddress = getClientIP(req);
        const userAgentString = req.headers['user-agent'] || '';
        const deviceInfo = parseUserAgent(userAgentString);
        const location = getLocationFromIP(ipAddress);

        console.log('[LOGIN_LOG] Recording failed login:', {
            email,
            ipAddress,
            reason,
            deviceName: deviceInfo.deviceName
        });

        const loginLog = new LoginLog({
            userId: null, // We don't know the user yet
            status: 'failed',
            ipAddress,
            browser: {
                name: deviceInfo.browser.name,
                version: deviceInfo.browser.version
            },
            os: {
                name: deviceInfo.os.name,
                version: deviceInfo.os.version
            },
            device: deviceInfo.device,
            deviceName: deviceInfo.deviceName, // ✅ Set for failed logins too
            userAgent: userAgentString,
            location: location, // ✅ Set for failed logins
            failureReason: reason,
            loginTime: new Date(),
        });

        await loginLog.save();
        console.log('[LOGIN_LOG] Failed login recorded successfully');
    } catch (error) {
        console.error('[LOGIN_LOG] Error logging failed login:', error);
    }
};

/**
 * Check if this is a new/suspicious location
 */
export const checkSuspiciousLogin = async (userId, ipAddress) => {
    try {
        // Check if this user has logged in from this IP before
        const existingLog = await LoginLog.findOne({
            userId,
            ipAddress,
            status: 'success'
        });

        return !existingLog; // True if new location
    } catch (error) {
        console.error('[LOGIN_LOG] Error checking suspicious login:', error);
        return false;
    }
};

/**
 * Get user's login history
 */
export const getUserLoginHistory = async (userId, limit = 10) => {
    try {
        const logs = await LoginLog.find({ userId, status: 'success' })
            .sort({ loginTime: -1 })
            .limit(limit)
            .select('-userAgent'); // Don't send raw user agent to frontend

        console.log('[LOGIN_LOG] Retrieved login history for user:', {
            userId,
            count: logs.length
        });

        return logs;
    } catch (error) {
        console.error('[LOGIN_LOG] Error getting login history:', error);
        return [];
    }
};

/**
 * Get login stats for admin
 */
export const getLoginStats = async (days = 7) => {
    try {
        const dateAgo = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const stats = await LoginLog.aggregate([
            { $match: { loginTime: { $gte: dateAgo } } },
            {
                $facet: {
                    totalLogins: [
                        { $match: { status: 'success' } },
                        { $count: 'count' }
                    ],
                    successfulLogins: [
                        { $match: { status: 'success' } },
                        { $count: 'count' }
                    ],
                    failedLogins: [
                        { $match: { status: 'failed' } },
                        { $count: 'count' }
                    ],
                    uniqueUsers: [
                        { $match: { status: 'success' } },
                        { $group: { _id: '$userId' } },
                        { $count: 'count' }
                    ],
                    topBrowsers: [
                        { $match: { status: 'success' } },
                        {
                            $group: {
                                _id: '$browser.name',
                                count: { $sum: 1 }
                            }
                        },
                        { $sort: { count: -1 } },
                        { $limit: 5 },
                        {
                            $project: {
                                name: '$_id',
                                count: 1,
                                _id: 0
                            }
                        }
                    ],
                    topOS: [
                        { $match: { status: 'success' } },
                        {
                            $group: {
                                _id: '$os.name',
                                count: { $sum: 1 }
                            }
                        },
                        { $sort: { count: -1 } },
                        { $limit: 5 },
                        {
                            $project: {
                                name: '$_id',
                                count: 1,
                                _id: 0
                            }
                        }
                    ],
                    // already have counts by device
                    loginsByDevice: [
                        { $match: { status: 'success' } },
                        { $group: { _id: '$device', count: { $sum: 1 } } }
                    ],
                    // NEW: topDevices – same as loginsByDevice but projected as {name, count}
                    topDevices: [
                        { $match: { status: 'success' } },
                        { $group: { _id: '$device', count: { $sum: 1 } } },
                        { $sort: { count: -1 } },
                        { $limit: 5 },
                        {
                            $project: {
                                name: '$_id',
                                count: 1,
                                _id: 0
                            }
                        }
                    ],
                    uniqueIPs: [
                        { $match: { status: 'success' } },
                        { $group: { _id: '$ipAddress' } },
                        { $count: 'count' }
                    ]
                }
            }
        ]);

        const result = stats[0] || {};

        const totalLoginsCount = result.totalLogins?.[0]?.count || 0;
        const successfulCount = result.successfulLogins?.[0]?.count || 0;
        const failedCount = result.failedLogins?.[0]?.count || 0;
        const uniqueUsersCount = result.uniqueUsers?.[0]?.count || 0;
        const uniqueIPsCount = result.uniqueIPs?.[0]?.count || 0;

        return {
            totalLogins: totalLoginsCount,
            successfulLogins: successfulCount,
            failedLogins: failedCount,
            failureRate:
                successfulCount > 0
                    ? ((failedCount / successfulCount) * 100).toFixed(2)
                    : 0,
            uniqueUsers: uniqueUsersCount,
            avgLoginsPerUser:
                uniqueUsersCount > 0
                    ? (totalLoginsCount / uniqueUsersCount).toFixed(2)
                    : 0,
            topBrowsers: result.topBrowsers || [],
            topOS: result.topOS || [],
            loginsByDevice: result.loginsByDevice || [],
            topDevices: result.topDevices || [],       // ✅ new field
            uniqueIPs: uniqueIPsCount
        };
    } catch (error) {
        console.error('[LOGIN_LOG] Error getting login stats:', error);
        return {
            totalLogins: 0,
            successfulLogins: 0,
            failedLogins: 0,
            failureRate: 0,
            uniqueUsers: 0,
            avgLoginsPerUser: 0,
            topBrowsers: [],
            topOS: [],
            loginsByDevice: [],
            topDevices: [],                            // ✅ keep shape consistent
            uniqueIPs: 0
        };
    }
};

