import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SearchBox from './SearchBox';

jest.useFakeTimers();

test('debounces search calls by ~250ms', async () => {
  const onSearch = jest.fn();
  render(<SearchBox onSearch={onSearch} delay={250} />);

  const input = screen.getByLabelText(/search/i);
  fireEvent.change(input, { target: { value: 'r' } });
  fireEvent.change(input, { target: { value: 're' } });
  fireEvent.change(input, { target: { value: 'rea' } });

  // fast typing shouldn't call onSearch yet
  expect(onSearch).not.toHaveBeenCalled();

  // advance time past debounce
  jest.advanceTimersByTime(251);

  await waitFor(() => expect(onSearch).toHaveBeenCalledTimes(1));
  expect(onSearch).toHaveBeenCalledWith('rea');
});

test('shows loading state while searching', async () => {
  let resolve!: () => void;
  const onSearch = jest.fn(() => new Promise<void>(r => { resolve = r; }));

  render(<SearchBox onSearch={onSearch} delay={100} />);
  const input = screen.getByLabelText(/search/i);
  fireEvent.change(input, { target: { value: 'hello' } });

  jest.advanceTimersByTime(101);
  // after debounce, call is pending -> aria-busy true
  const field = screen.getByLabelText(/search/i);
  expect(field).toHaveAttribute('aria-busy', 'true');

  // finish request
  resolve();
  await waitFor(() => expect(field).toHaveAttribute('aria-busy', 'false'));
});
