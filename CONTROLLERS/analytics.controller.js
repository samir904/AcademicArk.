// BACKEND/CONTROLLERS/analytics.controller.js - COMPLETELY FIXED

import { BetaAnalyticsDataClient } from '@google-analytics/data'
import Apperror from '../UTIL/error.util.js'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import dbConnection from '../CONFIG/db.config.js'
// Get absolute path for the current file
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Initialize GA client with absolute path
const analyticsDataClient = new BetaAnalyticsDataClient({
  keyFilename: join(__dirname, '../CONFIG/google-analytics-key.json')  // ✅ FIXED: Absolute path
})

const PROPERTY_ID = 511780400  // ✅ FIXED: Just the number, no prefix

export const getAnalytics = async (req, res, next) => {
  try {
    console.log('📊 Fetching analytics for property:', PROPERTY_ID)

    const response = await analyticsDataClient.runReport({
      property: `properties/${PROPERTY_ID}`,
      dateRanges: [
        {
          startDate: getDateString(7),
          endDate: 'today',
        },
      ],
      metrics: [
        { name: 'activeUsers' },
        { name: 'totalUsers' },
        { name: 'sessions' },
        { name: 'screenPageViews' },
        { name: 'bounceRate' },
        { name: 'averageSessionDuration' },
      ],
      dimensions: [
        { name: 'date' },
        { name: 'country' },
        { name: 'deviceCategory' },
      ],
    })

    console.log('✅ Response received, rows:', response[0]?.rows?.length)

    // ✅ FIXED: Check if response has data
    if (!response[0] || !response[0].rows || response[0].rows.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No data available yet',
        data: {
          analytics: [],
          totalSessions: 0,
          totalPageViews: 0,
          avgBounceRate: '0',
          avgSessionTime: '0',
        }
      })
    }

    // ✅ FIXED: Correct array indexing with [0], [1], [2]
    const data = response[0].rows.map(row => ({
      date: row.dimensionValues[0]?.value || 'N/A',
      country: row.dimensionValues[1]?.value || 'N/A',
      device: row.dimensionValues[2]?.value || 'N/A',
      activeUsers: row.metricValues[0]?.value || 0,
      totalUsers: row.metricValues[1]?.value || 0,
      sessions: row.metricValues[2]?.value || 0,
      pageViews: row.metricValues[3]?.value || 0,
      bounceRate: row.metricValues[4]?.value || 0,
      avgDuration: row.metricValues[5]?.value || 0,
    }))

    res.status(200).json({
      success: true,
      message: 'Analytics retrieved successfully',
      data: {
        analytics: data,
        totalSessions: sumMetric(data, 'sessions'),
        totalPageViews: sumMetric(data, 'pageViews'),
        avgBounceRate: data.length > 0 ? (sumMetric(data, 'bounceRate') / data.length).toFixed(2) : '0',
        avgSessionTime: data.length > 0 ? (sumMetric(data, 'avgDuration') / data.length).toFixed(2) : '0',
      }
    })
  } catch (error) {
    console.error('❌ Analytics error:', error.message)
    console.error('Full error:', error)
    return next(new Apperror('Failed to get analytics', 500))
  }
}

// ✅ FIXED: Date string function
function getDateString(daysAgo) {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  return date.toISOString().split('T')[0]  // ✅ Added [0] to get string
}

function sumMetric(data, key) {
  return data.reduce((sum, item) => sum + parseInt(item[key] || 0), 0)
}

export const getTopPages = async (req, res, next) => {
  try {
    const response = await analyticsDataClient.runReport({
      property: `properties/${PROPERTY_ID}`,
      dateRanges: [{ startDate: getDateString(30), endDate: 'today' }],
      metrics: [{ name: 'screenPageViews' }, { name: 'bounceRate' }],
      dimensions: [{ name: 'pagePath' }],
      orderBys: [{ metric: { metricName: 'screenPageViews' }, descending: true }],
      limit: 10,
    })

    // ✅ FIXED: Check if data exists
    if (!response[0] || !response[0].rows || response[0].rows.length === 0) {
      return res.status(200).json({
        success: true,
        data: []
      })
    }

    // ✅ FIXED: Correct indexing
    const topPages = response[0].rows.map(row => ({
      page: row.dimensionValues[0]?.value || 'N/A',
      views: row.metricValues[0]?.value || 0,
      bounceRate: row.metricValues[1]?.value || 0,
    }))

    res.status(200).json({
      success: true,
      data: topPages
    })
  } catch (error) {
    console.error('❌ Top pages error:', error.message)
    return next(new Apperror('Failed to get top pages', 500))
  }
}

export const getTrafficSources = async (req, res, next) => {
  try {
    const response = await analyticsDataClient.runReport({
      property: `properties/${PROPERTY_ID}`,
      dateRanges: [{ startDate: getDateString(30), endDate: 'today' }],
      metrics: [{ name: 'sessions' }],
      dimensions: [{ name: 'sessionSource' }],
      orderBys: [{ metric: { metricName: 'sessions' }, descending: true }],
      limit: 10,
    })

    // ✅ FIXED: Check if data exists
    if (!response[0] || !response[0].rows || response[0].rows.length === 0) {
      return res.status(200).json({
        success: true,
        data: []
      })
    }

    // ✅ FIXED: Correct indexing
    const sources = response[0].rows.map(row => ({
      source: row.dimensionValues[0]?.value || 'Direct',
      sessions: row.metricValues[0]?.value || 0,
    }))

    res.status(200).json({
      success: true,
      data: sources
    })
  } catch (error) {
    console.error('❌ Traffic sources error:', error.message)
    return next(new Apperror('Failed to get traffic sources', 500))
  }
}