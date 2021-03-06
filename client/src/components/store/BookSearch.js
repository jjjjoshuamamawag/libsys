import React, { Component } from 'react'
import axios from 'axios'
import BookList from './BookList'
import { Input, Icon, Pagination } from 'semantic-ui-react'

class BookSearch extends Component {
	state = { search: '', data: {}, activePage: 1 }

	componentDidMount = () => {
		this.search()
	}

	async onChange(e) {
		await this.setState({ [e.target.name]: e.target.value })
		this.search()
	}

	handlePaginationChange = async (e, { activePage }) => {
		await this.setState({ activePage })
		this.search()
	}

	async search() {
		if (this.state.search === '') {
			const res = await axios.get(`/books/all?page=${this.state.activePage}`, {
				headers: { 'x-auth-token': localStorage.token }
			})
			await this.setState({ data: res.data })
		} else {
			const res = await axios.get(
				`/books/search?search=${this.state.search}&page=${this.state.activePage}`
			)
			await this.setState({ data: res.data })
		}
	}

	render() {
		const { data, activePage } = this.state

		return (
			<React.Fragment>
				<Input
					fluid
					icon="search"
					placeholder="Search title, author, date published..."
					value={this.state.search}
					onChange={(e) => this.onChange(e)}
					name="search"
					autoComplete="off"
				/>
				{data.docs ? (
					<React.Fragment>
						<BookList books={data.docs} />
						{data.totalPages > 1 ? (
							<Pagination
								activePage={activePage}
								ellipsisItem={{ content: <Icon name="ellipsis horizontal" />, icon: true }}
								firstItem={{ content: <Icon name="angle double left" />, icon: true }}
								lastItem={{ content: <Icon name="angle double right" />, icon: true }}
								prevItem={{ content: <Icon name="angle left" />, icon: true }}
								nextItem={{ content: <Icon name="angle right" />, icon: true }}
								style={{ marginTop: '20px', marginBottom: '20px' }}
								totalPages={data.totalPages}
								onPageChange={this.handlePaginationChange}
								floated="right"
							/>
						) : (
							''
						)}
					</React.Fragment>
				) : (
					''
				)}
			</React.Fragment>
		)
	}
}

export default BookSearch
