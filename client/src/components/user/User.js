import React, { Component } from 'react'
import axios from 'axios'
import Profile from './ProfileTemplate'
import TicketList from '../tickets/TicketListTemplate'
import { connect } from 'react-redux'
import { Loader, Grid } from 'semantic-ui-react'
import PropTypes from 'prop-types'

class User extends Component {
	state = { user: {}, loading: true }

	componentDidMount = async () => {
		// Check if there's a param
		if (this.props.match.params.user_id) {
			// > Get user's account if so
			const res = await axios.get(`/user/${this.props.match.params.user_id}`)
			await this.setState({ user: res.data, loading: false })
		}
	}

	render() {
		console.log(this.state.user)
		if (!this.props.match.params.user_id) {
			// Pass user from redux instead
			return (
				<Grid>
					<Grid.Row>
						<Grid.Column width={5}>
							<Profile user={this.props.auth.user} />
						</Grid.Column>
						<Grid.Column width={11}>
							<TicketList tickets={this.props.auth.user.tickets} />
						</Grid.Column>
					</Grid.Row>
				</Grid>
			)
		} else if (!this.state.loading) {
			return (
				<Grid>
					<Grid.Row>
						<Grid.Column width={5}>
							<Profile user={this.state.user} />
						</Grid.Column>
						<Grid.Column width={11}>
							<TicketList tickets={this.state.user.tickets} />
						</Grid.Column>
					</Grid.Row>
				</Grid>
			)
		}
		return <Loader active inline="centered" />
	}
}

User.propTypes = {
	match: PropTypes.object,
	auth: PropTypes.object
}

const mapStateToProps = ({ auth }) => ({ auth })

export default connect(mapStateToProps)(User)
