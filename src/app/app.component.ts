import { Component } from '@angular/core';
import { SchedulePageComponent } from './pages/schedule/schedule-page.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [SchedulePageComponent],
  template: `<app-schedule-page />`,
})
export class AppComponent {}
