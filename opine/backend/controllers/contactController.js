const Contact = require('../models/Contact');

// @desc    Get all contacts
// @route   GET /api/contacts
// @access  Public (for now, should be private in production)
const getAllContacts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      inquiryType,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      search
    } = req.query;

    // Build filter object
    const filter = {};
    if (status) filter.status = status;
    if (inquiryType) filter.inquiryType = inquiryType;
    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { company: { $regex: search, $options: 'i' } },
        { subject: { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query
    const contacts = await Contact.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .select('-__v');

    const total = await Contact.countDocuments(filter);

    res.json({
      success: true,
      data: contacts,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching contacts:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching contacts',
      error: error.message
    });
  }
};

// @desc    Get single contact
// @route   GET /api/contacts/:id
// @access  Public (for now, should be private in production)
const getContact = async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id).select('-__v');
    
    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Contact not found'
      });
    }

    res.json({
      success: true,
      data: contact
    });
  } catch (error) {
    console.error('Error fetching contact:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching contact',
      error: error.message
    });
  }
};

// @desc    Create new contact
// @route   POST /api/contacts
// @access  Public
const createContact = async (req, res) => {
  try {
    // Extract IP and User Agent for tracking
    const ipAddress = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
    const userAgent = req.get('User-Agent');

    const contactData = {
      ...req.body,
      ipAddress,
      userAgent
    };

    const contact = new Contact(contactData);
    await contact.save();

    res.status(201).json({
      success: true,
      message: 'Contact form submitted successfully',
      data: {
        id: contact._id,
        fullName: contact.fullName,
        email: contact.email,
        subject: contact.subject,
        status: contact.status,
        createdAt: contact.createdAt
      }
    });
  } catch (error) {
    console.error('Error creating contact:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error creating contact',
      error: error.message
    });
  }
};

// @desc    Update contact
// @route   PUT /api/contacts/:id
// @access  Public (for now, should be private in production)
const updateContact = async (req, res) => {
  try {
    const contact = await Contact.findByIdAndUpdate(
      req.params.id,
      req.body,
      { 
        new: true, 
        runValidators: true 
      }
    ).select('-__v');

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Contact not found'
      });
    }

    res.json({
      success: true,
      message: 'Contact updated successfully',
      data: contact
    });
  } catch (error) {
    console.error('Error updating contact:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error updating contact',
      error: error.message
    });
  }
};

// @desc    Delete contact
// @route   DELETE /api/contacts/:id
// @access  Public (for now, should be private in production)
const deleteContact = async (req, res) => {
  try {
    const contact = await Contact.findByIdAndDelete(req.params.id);

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Contact not found'
      });
    }

    res.json({
      success: true,
      message: 'Contact deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting contact:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting contact',
      error: error.message
    });
  }
};

// @desc    Get contact statistics
// @route   GET /api/contacts/stats
// @access  Public (for now, should be private in production)
const getContactStats = async (req, res) => {
  try {
    const stats = await Contact.getStats();
    
    // Get recent contacts (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentContacts = await Contact.countDocuments({
      createdAt: { $gte: thirtyDaysAgo }
    });

    // Get inquiry type distribution
    const inquiryStats = await Contact.aggregate([
      {
        $group: {
          _id: '$inquiryType',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    res.json({
      success: true,
      data: {
        ...stats,
        recentContacts,
        inquiryTypes: inquiryStats
      }
    });
  } catch (error) {
    console.error('Error fetching contact stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching contact statistics',
      error: error.message
    });
  }
};

// @desc    Mark contact as responded
// @route   PATCH /api/contacts/:id/respond
// @access  Public (for now, should be private in production)
const respondToContact = async (req, res) => {
  try {
    const { response, respondedBy } = req.body;

    if (!response || !respondedBy) {
      return res.status(400).json({
        success: false,
        message: 'Response and respondedBy are required'
      });
    }

    const contact = await Contact.findById(req.params.id);
    
    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Contact not found'
      });
    }

    await contact.markAsResponded(response, respondedBy);

    res.json({
      success: true,
      message: 'Response recorded successfully',
      data: contact
    });
  } catch (error) {
    console.error('Error responding to contact:', error);
    res.status(500).json({
      success: false,
      message: 'Error recording response',
      error: error.message
    });
  }
};

module.exports = {
  getAllContacts,
  getContact,
  createContact,
  updateContact,
  deleteContact,
  getContactStats,
  respondToContact
};
