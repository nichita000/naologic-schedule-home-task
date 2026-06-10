import { calculateTooltipPosition, TooltipPosition } from './tooltip.directive';

describe('calculateTooltipPosition', () => {
  const host = {
    top: 100,
    right: 220,
    bottom: 124,
    left: 100,
    width: 120,
    height: 24,
  };
  const tip = {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    width: 240,
    height: 26,
  };
  const viewport = { width: 500, height: 400 };
  const padding = { left: 8, right: 8 };

  it('aligns top-left tooltip text with the host text start', () => {
    const result = calculateTooltipPosition('top-left', host, tip, viewport, padding);

    expect(result).toEqual({ left: 92, top: 66 });
  });

  it('centers top and bottom positions over the host', () => {
    expect(calculateTooltipPosition('top', host, tip, viewport, padding)).toEqual({
      left: 40,
      top: 66,
    });
    expect(calculateTooltipPosition('bottom', host, tip, viewport, padding)).toEqual({
      left: 40,
      top: 132,
    });
  });

  it('aligns right-side positions using the tooltip content end', () => {
    expect(calculateTooltipPosition('top-right', host, tip, viewport, padding)).toEqual({
      left: 8,
      top: 66,
    });
    expect(calculateTooltipPosition('bottom-right', host, tip, viewport, padding)).toEqual({
      left: 8,
      top: 132,
    });
  });

  it('places side positions next to the host and centers them vertically', () => {
    expect(calculateTooltipPosition('right', host, tip, viewport, padding)).toEqual({
      left: 228,
      top: 99,
    });
    expect(calculateTooltipPosition('left', host, tip, viewport, padding)).toEqual({
      left: 8,
      top: 99,
    });
  });

  it('keeps the tooltip inside the viewport margin', () => {
    const edgeHost = {
      ...host,
      left: 470,
      right: 490,
      width: 20,
    };

    const result = calculateTooltipPosition('right', edgeHost, tip, viewport, padding);

    expect(result.left).toBe(252);
  });

  it('supports every declared position', () => {
    const positions: TooltipPosition[] = [
      'top-left',
      'top',
      'top-right',
      'right',
      'bottom-right',
      'bottom',
      'bottom-left',
      'left',
    ];

    for (const position of positions) {
      const result = calculateTooltipPosition(position, host, tip, viewport, padding);
      expect(Number.isFinite(result.left)).toBeTrue();
      expect(Number.isFinite(result.top)).toBeTrue();
    }
  });
});
