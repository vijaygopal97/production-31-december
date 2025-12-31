const express = require('express');
const router = express.Router();
const {
  getAllContacts,
  getContact,
  createContact,
  updateContact,
  deleteContact,
  getContactStats,
  respondToContact
} = require('../controllers/contactController');

// @route   GET /api/contacts/stats
// @desc    Get contact statistics
// @access  Public
router.get('/stats', getContactStats);

// @route   GET /api/contacts
// @desc    Get all contacts with filtering, sorting, and pagination
// @access  Public (should be private in production)
router.get('/', getAllContacts);

// @route   GET /api/contacts/:id
// @desc    Get single contact by ID
// @access  Public (should be private in production)
router.get('/:id', getContact);

// @route   POST /api/contacts
// @desc    Create new contact
// @access  Public
router.post('/', createContact);

// @route   PUT /api/contacts/:id
// @desc    Update contact
// @access  Public (should be private in production)
router.put('/:id', updateContact);

// @route   PATCH /api/contacts/:id/respond
// @desc    Mark contact as responded
// @access  Public (should be private in production)
router.patch('/:id/respond', respondToContact);

// @route   DELETE /api/contacts/:id
// @desc    Delete contact
// @access  Public (should be private in production)
router.delete('/:id', deleteContact);

module.exports = router;
