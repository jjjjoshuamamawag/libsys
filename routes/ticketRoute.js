const express = require('express')
const router = express.Router()
const mongoose = require('mongoose')
const auth = require('../middleware/auth')
const admin = require('../middleware/admin')
const Ticket = mongoose.model('Ticket')
const Book = mongoose.model('Book')

// @route 	GET /tickets/
// @desc 	 	Get current user's tickets
// @access 	Admin
router.get('/tickets', auth, admin, async (req, res) => {
	try {
		const tickets = await Ticket.find({ borrower: req.user.id })
		res.send(tickets)
	} catch (e) {
		console.error(e.message)
		res.status(400).send(e.message)
	}
})

// @route 	GET /tickets/:option
// @desc 	 	Get tickets
// @access 	Admin
router.get('/tickets/:sort_order', auth, admin, async (req, res) => {
	try {
		let options = {}
		switch (req.params.sort_order) {
			// Backend Routes
			// > "/tickets/0" (all)
			// > "/tickets/1" (pickup)
			// > "/tickets/2" (borrow)
			// > "/tickets/3" (return)
			// > "/tickets/4" (active)
			// > "/tickets/5"  (ended)
			case '0':
				options = {}
				break
			case '1':
				options = { sort_order: 1 }
				break
			case '2':
				options = { sort_order: 2 }
				break
			case '3':
				options = { sort_order: 3 }
				break
			case '4':
				options = { sort_order: 4 }
				break
			case '5':
				options = { sort_order: 5 }
				break
			default:
				throw new Error('Invalid argument.')
		}

		const tickets = await Ticket.find(options).select('-event_logs')
		res.send(tickets)
	} catch (e) {
		console.error(e.message)
		res.status(500).send(e.message)
	}
})

// @route 	POST /borrow/
// @desc 	 	Issue a borrow request from checkout
// @access 	Student, Admin
router.post('/borrow', auth, async (req, res) => {
	try {
		// See if there's a book that's not available
		const books = await Book.find({ _id: { $in: req.body.checkoutItems }, available: { $lt: 1 } })
		if (books.length > 0)
			throw new Error(`The following books are not available: ${books.map((book) => book.title)}`)

		// Check if current user has active ticket for the books
		const openTicket = await Ticket.find({
			borrower: req.user._id,
			sort_order: { $lt: 5 },
			book: { $in: req.body.checkoutItems }
		})

		if (openTicket.length > 0)
			throw new Error(
				`You still have active tickets for the following books: ${openTicket.map(
					({ book }) => book.title
				)}`
			)

		req.body.checkoutItems.forEach(async (book_id) => {
			const ticket = new Ticket()
			ticket.book = book_id
			ticket.borrower = req.user._id
			ticket.status = 'Pending (Borrow)'
			ticket.sort_order = 2
			await ticket.save()
			await ticket.addEventLog('Borrow Request', req.user.id)
		})

		// Remove books from the Cart
		req.user.cart = req.user.cart.filter(({ id }) => !req.body.checkoutItems.includes(id))
		await req.user.save()
		res.send(req.user.cart)
	} catch (e) {
		console.error(e.message)
		res.status(400).send(e.message)
	}
})

// @route 	POST /borrow/:book_id/accept/:ticket_id
// @desc 	 	Accepting a borrow request
// @access 	Admin
router.post('/borrow/:ticket_id/accept', auth, admin, async (req, res) => {
	try {
		// Check if pendingBorrow
		const ticket = await Ticket.findOne({ _id: req.params.ticket_id, status: 'pendingBorrow' })
		if (!ticket) throw new Error('Ticket not valid')

		// Change ticket status to 'active'
		ticket.status = 'active'
		// Edits the 'from' field
		ticket.from = Date.now()
		// Adds to the history 'Accepted borrow request' status and by current logged in admin
		ticket.history.push({
			status: 'Accepted borrow request',
			by: req.user._id,
			time: Date.now()
		})
		// Remove one from available books
		// @todo	Book has to be available
		const book = await Book.findById(ticket.book)
		// @todo	If book.available = 0, then all pending tickets for book will be declined
		book.available -= 1
		await book.save()
		await ticket.save()
		res.send({ ticket })
	} catch (e) {
		console.error(e.message)
		res.status(400).send(e.message)
	}
})

// @route 	POST /borrow/:ticket_id/decline
// @desc 	 	Declining a borrow request
// @access 	Admin
router.post('/borrow/:ticket_id/decline', auth, admin, async (req, res) => {
	try {
		// Check if pendingBorrow
		const ticket = await Ticket.findOne({ _id: req.params.ticket_id, status: 'pendingBorrow' })
		if (!ticket) throw new Error('Ticket not valid')

		// Change ticket status to 'declined'
		ticket.status = 'declined'
		// Adds to the history 'Declined borrow request' status and by current logged in admin
		ticket.history.push({
			status: 'Declined borrow request',
			by: req.user._id,
			time: Date.now()
		})
		await ticket.save()
		res.send({ ticket })
	} catch (e) {
		console.error(e.message)
		res.status(400).send(e.message)
	}
})

// @route 	POST /return/:ticket_id
// @desc 	 	Issue a return request
// @access 	Student, Admin
router.post('/return/:ticket_id', auth, async (req, res) => {
	try {
		const ticket = await Ticket.findOne({
			_id: req.params.ticket_id,
			borrower: req.user.id,
			status: 'active'
		})
		if (!ticket) throw new Error('Invalid ticket')
		// Set ticket status to 'pendingReturn'
		ticket.status = 'pendingReturn'
		await ticket.save()
		res.send({ ticket })
	} catch (e) {
		console.error(e.message)
		res.status(400).send(e.message)
	}
})

// @route 	POST /return/:book_id/accept/:ticket_id
// @desc 	 	Accepting a return request
// @access 	Admin
router.post('/return/:ticket_id/accept', auth, admin, async (req, res) => {
	try {
		// Check if ticket status is 'pendingReturn'
		const ticket = await Ticket.findOne({ _id: req.params.ticket_id, status: 'pendingReturn' })
		if (!ticket) throw new Error('Invalid ticket.')
		// Change ticket status to 'returned'
		ticket.status = 'returned'
		// Set current Time&Date to 'to'
		ticket.to = Date.now()
		// Adds to the history 'Accepted return request' status and by current logged in admin
		ticket.history.push({
			status: 'Accepted return request',
			by: req.user._id,
			time: Date.now()
		})
		// Adds one to the number of available books
		const book = await Book.findById(ticket.book)
		book.available += 1
		await book.save()
		await ticket.save()
		res.send({ ticket })
	} catch (e) {
		console.error(e.message)
		res.status(400).send(e.message)
	}
})

// @route 	POST /return/:book_id/decline/:ticket_id
// @desc 	 	Declining a return request
// @access 	Admin
router.post('/return/:ticket_id/decline', auth, admin, async (req, res) => {
	try {
		// Check if ticket status is 'pendingReturn'
		const ticket = await Ticket.findOne({ _id: req.params.ticket_id, status: 'pendingReturn' })
		if (!ticket) throw new Error('Invalid ticket.')
		// Change ticket status to 'active'
		ticket.status = 'active'
		// Adds to the history 'Declined return request' status and by current logged in admin
		ticket.history.push({
			status: 'Declined return request',
			by: req.user._id,
			time: Date.now()
		})

		await ticket.save()
		res.send({ ticket })
	} catch (e) {
		console.error(e.message)
		res.status(500).send(e.message)
	}
})

// @route 	GET /ticket/:ticket_id
// @desc 	 	Get ticket details
// @access 	Admin
router.get('/ticket/:ticket_id', auth, admin, async (req, res) => {
	try {
		const ticket = await Ticket.findById(req.params.ticket_id)
			.populate('book', ['title'])
			.populate('borrower', ['name', 'email'])
		if (!ticket) throw new Error('Invalid ticket')

		res.send({ ticket })
	} catch (e) {
		console.error(e.message)
		res.status(400).send(e.message)
	}
})

// @route 	POST /cancel/:ticket_id
// @desc 	 	Cancel ticket
// @access 	Owner of the ticket
router.post('/cancel/:ticket_id', auth, async (req, res) => {
	try {
		const ticket = await Ticket.findOne({
			_id: req.params.ticket_id,
			status: { $in: ['pendingBorrow', 'pendingReturn'] },
			borrower: req.user._id
		})
		if (!ticket) throw new Error('Ticket not valid.')

		if (ticket.status === 'pendingBorrow') {
			ticket.status = 'cancelled'
		} else {
			ticket.status = 'active'
		}

		await ticket.save()

		res.send({ ticket })
	} catch (e) {
		console.error(e.message)
		res.status(400).send(e.message)
	}
})

module.exports = router
