const express = require('express');
const router = express.Router();
const {
  getRoundNumbersByAC,
  getGroupsByAC,
  getPollingStationsByGroup,
  getPollingStationGPS,
  checkPollingStationsUpdate,
  downloadPollingStations
} = require('../controllers/pollingStationController');
const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

router.get('/rounds/:state/:acIdentifier', getRoundNumbersByAC);
router.get('/groups/:state/:acIdentifier', getGroupsByAC);
router.get('/stations/:state/:acIdentifier/:groupName', getPollingStationsByGroup);
router.get('/gps/:state/:acIdentifier/:groupName/:stationName', getPollingStationGPS);
router.get('/check-update', checkPollingStationsUpdate);
router.get('/download', downloadPollingStations);
// Get AC metadata by AC code (numeric)
router.get('/ac/:acCode', async (req, res) => {
  try {
    const { acCode } = req.params;
    const { getGroupsForAC } = require('../utils/pollingStationHelper');
    const pollingData = require('../data/polling_stations.json');
    
    // Find AC by code in West Bengal
    const acData = pollingData['West Bengal']?.[acCode];
    
    if (!acData) {
      return res.status(404).json({
        success: false,
        message: 'AC not found'
      });
    }
    
    res.json({
      success: true,
      data: {
        ac_code: acCode,
        ac_name: acData.ac_name,
        pc_no: acData.pc_no || null,
        pc_name: acData.pc_name || null,
        district: acData.district || null,
        district_code: acData.district_code || null,
        region_code: acData.region_code || null,
        region_name: acData.region_name || null
      }
    });
  } catch (error) {
    console.error('Error fetching AC data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch AC data',
      error: error.message
    });
  }
});

module.exports = router;

