const express = require('express')
const router = express.Router()
const mongoose = require('mongoose')
const User = mongoose.model('User')
const auth = require('../middleware/auth')
const admin = require('../middleware/admin')

// @route 	GET /user/search?q=query
// @desc 	 	Get List of Users
// @access 	Admin
router.get('/search', auth, admin, async (req, res) => {
	try {
		const users = await User.find({
			$or: [
				{ name: { $regex: new RegExp(req.query.q), $options: 'i' } },
				{ studentId: { $regex: new RegExp(req.query.q), $options: 'i' } },
				{ employeeId: { $regex: new RegExp(req.query.q), $options: 'i' } }
			]
		})
			.limit(20)
			.sort({ createdAt: 1 })
			.select(['name', 'isAdmin', 'studentId', 'employeeId', 'email'])

		res.send(users)
	} catch (e) {
		console.error(e.message)
		res.status(500).send(e.message)
	}
})

// @route 	GET /user
// @desc 	 	Get User Details
// @access 	Registered User
router.get('/', auth, async (req, res) => {
	try {
		res.send({ user: req.user })
	} catch (e) {
		console.error(e.message)
		res.status(500).send(e.message)
	}
})

// @route 	GET /user/:user_id
// @desc 	 	Get a Specific User Details
// @access 	Registered User
router.get('/:user_id', auth, admin, async (req, res) => {
	try {
		const user = await User.findById(req.params.user_id).populate({
			path: 'tickets',
			select: ['book', 'event_logs', 'sort_order', 'status'],
			populate: {
				path: 'event_logs.by',
				select: ['name', 'isAdmin']
			}
		})
		if (!user) throw new Error('User not found.')

		res.send(user)
	} catch (e) {
		console.error(e.message)
		res.status(500).send(e.message)
	}
})

// @route 	PATCH /user
// @desc 	 	Edit User Details
// @access 	Registered User
router.patch('/', auth, async (req, res) => {
	const updates = Object.keys(req.body)
	const allowedUpdates = ['name', 'email', 'password']

	if (req.user.isAdmin) {
		allowedUpdates.push('employeeId')
	}

	const isValidOperation = updates.every((update) => allowedUpdates.includes(update))

	if (!isValidOperation) return res.status(400).send({ error: 'Invalid updates' })

	try {
		updates.forEach((update) => (req.user[update] = req.body[update]))

		await req.user.save()
		res.send(req.user)
	} catch (e) {
		console.error(e.message)
		res.status(500).send(e.message)
	}
})

// @route 	DELETE /user
// @desc 	 	Delete User Account
// @access 	Admin
router.delete('/:user_id', auth, admin, async (req, res) => {
	try {
		// Check first if there's an active or pending request
		const user = await User.findById(req.params.user_id).populate({
			path: 'tickets',
			match: {
				status: { $in: ['pendingBorrow', 'active'] }
			}
		})

		if (!user) throw new Error('Invalid user.')

		if (user.tickets.length > 0)
			throw new Error('User has pending requests or has a book in possession.')

		await user.remove()
		res.send({ user })
	} catch (e) {
		console.error(e.message)
		res.status(500).send(e.message)
	}
})

module.exports = router
