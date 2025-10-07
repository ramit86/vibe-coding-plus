import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

// 👉 If SearchBox is a *default* export, use:
// import SearchBox from './SearchBox';
// 👉 If it's a *named* export (export function SearchBox...), use:
import { SearchBox } from './SearchBox';

const DEBOUNCE_MS = 250; // match your component’s debounce

describe('SearchBox', () => {
  it('debounces input and toggles loading around the search', async () => {
    const onSearch = vi.fn().mockResolvedValue(undefined);

    render(<SearchBox onSearch={onSearch} />);

    const input = screen.getByRole('textbox');

    // Type -> component should eventually flip aria-busy to true
    await userEvent.type(input, 'hello');

    // Depending on implementation, busy may flip immediately or after debounce kicks flow off.
    await waitFor(
      () => expect(input).toHaveAttribute('aria-busy', 'true'),
      { timeout: DEBOUNCE_MS + 200 }
    );

    // Let the debounce window elapse so onSearch fires
    await new Promise((res) => setTimeout(res, DEBOUNCE_MS + 50));

    // onSearch called with latest value
    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenCalledWith('hello');

    // When the promise resolves, loading should turn off
    await waitFor(() => expect(input).toHaveAttribute('aria-busy', 'false'));
  });
  // append to src/components/SearchBox.test.tsx
it('does not call onSearch for empty input', async () => {
  const onSearch = vi.fn().mockResolvedValue(undefined);
  render(<SearchBox onSearch={onSearch} />);
  const input = screen.getByRole('textbox');
  await userEvent.type(input, '   '); // just spaces
  await new Promise((r) => setTimeout(r, 300)); // > debounce
  expect(onSearch).not.toHaveBeenCalled();
});

});
