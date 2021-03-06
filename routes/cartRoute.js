const express = require('express')
const router = express.Router()
const mongoose = require('mongoose')
const auth = require('../middleware/auth')
const admin = require('../middleware/admin')
const Ticket = mongoose.model('Ticket')
const Book = mongoose.model('Book')
const User = mongoose.model('User')

// @route 	GET /cart
// @desc 	 	List user's cart
// @access 	Student, Admin
router.get('/cart', auth, async (req, res) => {
	try {
		// If a book gets deleted, the item will be removed from the user's cart.
		if (req.user.cart.some(({ deleted }) => deleted === true)) {
			req.user.cart = req.user.cart.filter(({ deleted }) => deleted === false)
			await req.user.save()
		}

		res.send(req.user.cart)
	} catch (e) {
		console.error(e.message)
		res.status(500).send(e.message)
	}
})

// @route 	POST /cart
// @desc 	 	Adding something to cart
// @access 	Student, Admin
router.post('/cart', auth, async (req, res) => {
	try {
		// See if currently in cart
		if (req.user.cart.length > 0) {
			const found = req.user.cart.some((book) => book.toString() === req.body.book_id)
			if (found) throw new Error('Book is already in cart')
		}
		// Push to cart array
		const book = await Book.findOne({ _id: req.body.book_id, deleted: false })
		req.user.cart.push(book)
		await req.user.save()
		res.send(req.user.cart)
	} catch (e) {
		console.error(e.message)
		res.status(400).send(e.message)
	}
})

// @route 	POST /cart/remove
// @desc 	 	Removing an item from cart
// @access 	Student, Admin
// Untested
router.delete('/cart/remove/:book_id', auth, async (req, res) => {
	try {
		req.user.cart = req.user.cart.filter(({ _id }) => _id.toString() !== req.params.book_id)
		await req.user.save()
		res.send(req.user.cart)
	} catch (e) {
		console.error(e.message)
		res.status(500).send(e.message)
	}
})

// @route 	POST /checkout
// @desc 	 	Issue a borrow request from checkout
// @access 	Student, Admin
router.post('/checkout', auth, async (req, res) => {
	try {
		// See if there's a book that's not available
		const books = await Book.find({
			_id: { $in: req.body.checkoutItems },
			$or: [{ available: { $lt: 1 } }, { deleted: true }]
		})
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
			await ticket.save()
			await ticket.updateTicket({
				status: 'Pending (Borrow)',
				sort_order: 2,
				event: 'Borrow Request',
				user_id: req.user.id
			})
		})

		await req.user.refreshTickets()
		// Remove books from the Cart
		req.user.cart = req.user.cart.filter(({ id }) => !req.body.checkoutItems.includes(id))
		await req.user.save()
		res.send(req.user.cart)
	} catch (e) {
		console.error(e.message)
		res.status(400).send(e.message)
	}
})

module.exports = router
