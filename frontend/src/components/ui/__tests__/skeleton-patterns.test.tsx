import { render } from '@testing-library/react';
import { SkeletonRow, SkeletonCard, SkeletonList, SkeletonHero, SkeletonForm } from '../skeleton-patterns';

describe('skeleton-patterns', () => {
  test('SkeletonRow renders a single pulse div', () => {
    const { container } = render(<SkeletonRow />);
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBe(1);
  });

  test('SkeletonCard renders a larger pulse div', () => {
    const { container } = render(<SkeletonCard />);
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBe(1);
  });

  test('SkeletonList renders N items when given count=5', () => {
    const { container } = render(<SkeletonList count={5} />);
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBe(5);
  });

  test('SkeletonList renders 52 items for archive timeline case', () => {
    const { container } = render(<SkeletonList count={52} />);
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBe(52);
  });

  test('SkeletonHero renders score + 2 badges + button (4 blocks)', () => {
    const { container } = render(<SkeletonHero />);
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    // Hero shape: large number placeholder + 2 badge placeholders + button placeholder.
    expect(skeletons.length).toBe(4);
  });

  test('SkeletonForm renders 2 skeletons per field (label + input)', () => {
    const { container } = render(<SkeletonForm fieldCount={3} />);
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBe(6);
  });

  test('SkeletonForm defaults to 3 fields (6 skeletons)', () => {
    const { container } = render(<SkeletonForm />);
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBe(6);
  });
});
