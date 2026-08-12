import { Component } from 'react'

export default class AppErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Unexpected application error', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <main className="flex min-h-screen items-center justify-center bg-[#FEFEFE] p-6">
        <section role="alert" className="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-7 text-center shadow-xl">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-xl text-[#FD5461]">!</div>
          <h1 className="mt-4 type-heading text-[#0A1318]">Something went wrong</h1>
          <p className="mt-2 type-body text-gray-500">The page could not finish loading. Your saved data has not been changed.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 min-h-11 w-full rounded-xl bg-[#FD5461] px-5 py-2.5 type-body font-medium text-white hover:bg-[#e03d4a]"
          >
            Reload page
          </button>
        </section>
      </main>
    )
  }
}
