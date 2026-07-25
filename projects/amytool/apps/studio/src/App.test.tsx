import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { App } from './App';

function renderApp(initialPath = '/') {
  return render(
    <MemoryRouter
      initialEntries={[initialPath]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <App />
    </MemoryRouter>,
  );
}

describe('App shell', () => {
  it('redirects / to the patch workspace', () => {
    renderApp('/');
    expect(screen.getByRole('link', { name: 'Patch' }).className).toContain('tab-active');
  });

  it('shows all four workspace tabs and the board status', () => {
    renderApp();
    for (const label of ['Patch', 'Code', 'Library', 'Settings']) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument();
    }
    expect(screen.getByTestId('board-status')).toBeInTheDocument();
  });

  it('navigates between workspaces via tabs', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('link', { name: 'Settings' }));
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Code' }));
    expect(await screen.findByText('sketch.py')).toBeInTheDocument();
  });
});
