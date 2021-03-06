const mongoose = require('mongoose')
const validator = require('validator')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const mongooseAutopopulate = require('mongoose-autopopulate')
const Ticket = mongoose.model('Ticket')

const userSchema = mongoose.Schema(
	{
		name: {
			type: String,
			required: true
		},
		isAdmin: {
			type: Boolean,
			required: true,
			default: false
		},
		studentId: {
			type: String,
			default: null
		},
		employeeId: {
			type: String,
			default: null
		},
		email: {
			type: String,
			unique: true,
			required: true,
			trim: true,
			lowercase: true,
			validate(value) {
				if (!validator.isEmail(value)) throw new Error('Email is invalid.')
			}
		},
		password: {
			type: String,
			required: true,
			trim: true,
			minlength: 7,
			validate(value) {
				if (value.toLowerCase().includes('password'))
					throw new Error('Password must not include "password".')
			}
		},
		tokens: [
			{
				token: {
					type: String,
					required: true
				}
			}
		],
		cart: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Book', default: [] }],
		tickets: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', default: [] }]
	},
	{ timestamps: true }
)

userSchema.set('toObject', { virtuals: true })
userSchema.set('toJSON', { virtuals: true })

// Removing some stuff before sending the user back
userSchema.methods.toJSON = function() {
	// Convert user into an object
	const user = this
	const userObject = user.toObject()
	// Remove certain things
	delete userObject.password
	delete userObject.tokens
	delete userObject.cart

	if (userObject.isAdmin) {
		delete userObject.studentId
	} else {
		delete userObject.employeeId
	}

	return userObject
}

// Instance Method
userSchema.methods.generateAuthToken = async function() {
	const user = this
	const token = jwt.sign({ _id: user._id.toString() }, process.env.JWT_SECRET)

	user.tokens = [...user.tokens, { token }]

	await user.save()
	return token
}

userSchema.methods.refreshTickets = async function() {
	try {
		const user = this
		user.tickets = await Ticket.find({ borrower: user._id, sort_order: { $lt: 5 } })
			.populate({
				path: 'event_logs.by',
				select: 'name'
			})
			.sort({ updatedAt: -1 })
		// await user.save()
	} catch (e) {
		console.error(e.message)
	}
}

userSchema.methods.removeTicket = async function(ticket_id) {
	try {
		const user = this
		user.tickets = user.tickets.filter(({ _id }) => _id.toString() !== ticket_id.toString())
		await user.save()
	} catch (e) {
		console.error(e.message)
	}
}

// Hashing the plain text password before saving
userSchema.pre('save', async function(next) {
	const user = this
	if (user.isModified('password')) user.password = await bcrypt.hash(user.password, 8)
	next()
})

userSchema.plugin(mongooseAutopopulate)

// Static Method - accessible by User.findByCredentials
userSchema.statics.findByCredentials = async (email, password) => {
	const user = await User.findOne({ email })

	if (!user) throw new Error('Invalid credentials')

	const isMatch = await bcrypt.compare(password, user.password)

	if (!isMatch) throw new Error('Invalid credentials')

	await user.refreshTickets()

	return user
}

userSchema.statics.findAndRemoveTicket = async (user_id, ticket_id) => {
	const user = await User.findById(user_id)

	if (!user) throw new Error('User not found.')

	user.tickets = user.tickets.filter(({ _id }) => _id.toString() !== ticket_id.toString())

	await user.save()

	return
}

const User = mongoose.model('User', userSchema)
