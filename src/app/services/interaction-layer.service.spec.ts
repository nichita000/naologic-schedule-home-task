import { fakeAsync, tick } from '@angular/core/testing';
import { InteractionLayerService } from './interaction-layer.service';

describe('InteractionLayerService', () => {
  let service: InteractionLayerService;

  beforeEach(() => {
    service = new InteractionLayerService();
  });

  afterEach(() => {
    service.ngOnDestroy();
  });

  it('suppresses tooltips while an overlay is active', () => {
    service.openOverlay('compact-popover');

    expect(service.suppressTooltips()).toBeTrue();

    service.closeOverlay('compact-popover');

    expect(service.suppressTooltips()).toBeFalse();
  });

  it('suppresses tooltips briefly while scrolling', fakeAsync(() => {
    service.suppressTooltipsForScroll(120);

    expect(service.suppressTooltips()).toBeTrue();

    tick(119);
    expect(service.suppressTooltips()).toBeTrue();

    tick(1);
    expect(service.suppressTooltips()).toBeFalse();
  }));
});
