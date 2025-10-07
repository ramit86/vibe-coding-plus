// src/components/SearchBox.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { SearchBox } from './SearchBox';

// NOTE: adjust this to match your actual debounce delay inside SearchBox (e.g., 250ms)
const DEBOUNCE_MS = 250;

describe('SearchBox', () => {
  it('debounces input and toggles loading around the search', async () => {
    const onSearch = vi.fn().mockResolvedValue(undefined);

    render(<SearchBox onSearch={onSearch} />);

    const input = screen.getByRole('textbox');

    // type triggers immediate loading=true
    await userEvent.type(input, 'hello');

    // Because setLoading(true) should run before debounce fires, aria-busy should flip to true quickly.
    await waitFor(() =>
      expect(input).toHaveAttribute('aria-busy', 'true'),
      { timeout: 100 }
    );

    // advance past your debounce window by waiting a bit
    await new Promise(res => setTimeout(res, DEBOUNCE_MS + 50));

    // search should have been called once with latest value
    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenCalledWith('hello');

    // after the promise resolves, loading should turn off
    await waitFor(() =>
      expect(input).toHaveAttribute('aria-busy', 'false')
    );
  });
});
