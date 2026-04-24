import { render } from '@testing-library/react';
import { SkeletonRow, SkeletonCard, SkeletonList, SkeletonHero } from '../skeleton-patterns';

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

  test('SkeletonHero renders hero-sized blocks', () => {
    const { container } = render(<SkeletonHero />);
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    // Hero shape: large number placeholder + small badge placeholders + button placeholder.
    expect(skeletons.length).toBeGreaterThanOrEqual(1);
  });
});
