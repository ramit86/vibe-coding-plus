import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { SearchBox } from './SearchBox';

// Match your debounce duration inside SearchBox (250ms in your draft)
const DEBOUNCE_MS = 250;

describe('SearchBox', () => {
  it('debounces input and toggles loading around the search', async () => {
    const onSearch = vi.fn().mockResolvedValue(undefined);

    render(<SearchBox onSearch={onSearch} />);

    const input = screen.getByRole('textbox');

    // Type some text -> component should flip aria-busy to true
    await userEvent.type(input, 'hello');

    // Loading turns on quickly when effect starts (before debounce completes)
    await waitFor(() => expect(input).toHaveAttribute('aria-busy', 'true'), { timeout: 150 });

    // Let debounce elapse
    await new Promise(res => setTimeout(res, DEBOUNCE_MS + 50));

    // onSearch should be called once with the latest value
    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenCalledWith('hello');

    // After onSearch resolves, loading should turn off
    await waitFor(() => expect(input).toHaveAttribute('aria-busy', 'false'));
  });
});
