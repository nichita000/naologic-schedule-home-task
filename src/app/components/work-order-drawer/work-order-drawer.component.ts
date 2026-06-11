import { CommonModule } from '@angular/common';
import { AfterViewInit, ChangeDetectionStrategy, Component, OnChanges, OnDestroy, OnInit, SimpleChanges, ViewChild, computed, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { Options } from '@popperjs/core';
import { Subscription } from 'rxjs';
import { NgbDateStruct, NgbInputDatepicker } from '@ng-bootstrap/ng-bootstrap';
import { BadgeComponent, BadgeStatus } from '../badge/badge.component';
import { ButtonComponent, ButtonVariant } from '../button/button.component';
import { ScheduleOrder, WorkCenter } from '../schedule/schedule.component';
import { WorkOrderComponent } from '../work-order/work-order.component';
import { formatDateRange } from '../../utils/format-date-range';

/** Max characters allowed in a work-order name (UI + validation). */
export const WORK_ORDER_NAME_MAX_LENGTH = 60;

export type WorkOrderDrawerMode = 'create' | 'edit';

interface PickerInstance {
  model?: {
    firstDate?: { year: number; month: number; day: number };
    prevDisabled?: boolean;
    nextDisabled?: boolean;
  };
  i18n?: { getMonthFullName?: (month: number, year: number) => string };
  onNavigateEvent?: (direction: 0 | 1) => void;
  _service?: { model$?: { subscribe?: (cb: () => void) => { unsubscribe?: () => void } } };
}

export interface WorkOrderDrawerValue {
  id?: string;
  name: string;
  workCenterId: string;
  status: BadgeStatus;
  startDate: string;
  endDate: string;
}

type WorkOrderDrawerForm = FormGroup<{
  id: FormControl<string | null>;
  name: FormControl<string>;
  workCenterId: FormControl<string>;
  status: FormControl<BadgeStatus>;
  startDate: FormControl<NgbDateStruct | null>;
  endDate: FormControl<NgbDateStruct | null>;
}>;

@Component({
  selector: 'nao-work-order-drawer',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NgSelectModule, NgbInputDatepicker, BadgeComponent, ButtonComponent, WorkOrderComponent],
  templateUrl: './work-order-drawer.component.html',
  styleUrl: './work-order-drawer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkOrderDrawerComponent implements OnChanges, OnInit, OnDestroy, AfterViewInit {
  readonly mode = input<WorkOrderDrawerMode>('create');
  readonly value = input<WorkOrderDrawerValue | null>(null);
  readonly workCenters = input<WorkCenter[]>([]);
  /** All existing orders — used to detect overlaps on the same work centre. */
  readonly existingOrders = input<ScheduleOrder[]>([]);

  readonly closed = output<void>();
  readonly saved = output<WorkOrderDrawerValue>();
  /** Current draft, mirrored as a signal so computed validators react to it. */
  protected readonly draftSignal = signal<WorkOrderDrawerValue>(this.emptyDraft());

  protected readonly nameMaxLength = WORK_ORDER_NAME_MAX_LENGTH;
  protected readonly form: WorkOrderDrawerForm = new FormGroup({
    id: new FormControl<string | null>(null),
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(WORK_ORDER_NAME_MAX_LENGTH)] }),
    workCenterId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    status: new FormControl<BadgeStatus>(BadgeStatus.Open, { nonNullable: true, validators: [Validators.required] }),
    startDate: new FormControl<NgbDateStruct | null>(null, { validators: [Validators.required] }),
    endDate: new FormControl<NgbDateStruct | null>(null, { validators: [Validators.required] }),
  });

  protected readonly ButtonVariant = ButtonVariant;
  protected readonly datepickerPopperOptions = (options: Partial<Options>): Partial<Options> => ({
    ...options,
    modifiers: [
      ...(options.modifiers ?? []).filter(modifier => modifier.name !== 'flip'),
      { name: 'flip', enabled: false },
    ],
  });

  protected readonly statuses: Array<{ value: BadgeStatus; label: string }> = [
    { value: BadgeStatus.Open, label: 'Open' },
    { value: BadgeStatus.InProgress, label: 'In progress' },
    { value: BadgeStatus.Complete, label: 'Complete' },
    { value: BadgeStatus.Blocked, label: 'Blocked' },
  ];

  @ViewChild('startPicker') private startPicker?: NgbInputDatepicker;
  @ViewChild('endPicker') private endPicker?: NgbInputDatepicker;

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['value'] && !changes['mode']) {
      return;
    }
    const draft = { ...(this.value() ?? this.emptyDraft()) };
    this.form.reset(undefined, { emitEvent: false });
    this.form.setValue({
      id: draft.id ?? null,
      name: draft.name,
      workCenterId: draft.workCenterId,
      status: draft.status,
      startDate: this.parseIsoDate(draft.startDate),
      endDate: this.parseIsoDate(draft.endDate),
    }, { emitEvent: false });
    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.syncDraftSignal();
  }

  /** Sentinel bounds used when the paired date is not set yet. */
  private readonly UNRESTRICTED_DATE: NgbDateStruct = { year: 1900, month: 1, day: 1 };
  private readonly UNRESTRICTED_MAX_DATE: NgbDateStruct = { year: 2099, month: 12, day: 31 };

  protected readonly startMaxDate = computed<NgbDateStruct>(() => {
    const end = this.draftSignal().endDate;
    return end ? (this.parseIsoDate(end) ?? this.UNRESTRICTED_MAX_DATE) : this.UNRESTRICTED_MAX_DATE;
  });

  protected readonly endMinDate = computed<NgbDateStruct>(() => {
    const start = this.draftSignal().startDate;
    return start ? (this.parseIsoDate(start) ?? this.UNRESTRICTED_DATE) : this.UNRESTRICTED_DATE;
  });

  /** All conflicting orders on the same work centre (excluding the one being edited). */
  protected readonly overlaps = computed<ScheduleOrder[]>(() => {
    const draft = this.draftSignal();
    if (!draft.workCenterId || !draft.startDate || !draft.endDate || draft.endDate < draft.startDate) {
      return [];
    }
    return this.existingOrders().filter(order =>
      order.workCenterId === draft.workCenterId
      && (!draft.id || order.id !== draft.id)
      // Inclusive ISO-date range overlap: a.start <= b.end && a.end >= b.start
      && draft.startDate <= order.endDate
      && draft.endDate >= order.startDate
    );
  });

  protected readonly nameTooLong = computed(() => this.form.controls.name.hasError('maxlength'));
  protected readonly nameMissing = computed(() => !this.draftSignal().name.trim());
  protected readonly endBeforeStart = computed(() => {
    const d = this.draftSignal();
    return !!(d.startDate && d.endDate && d.endDate < d.startDate);
  });

  /** Human-readable date range like "May 1, 2026 – Jun 19, 2026". */
  protected formatRange(start: string, end: string): string {
    return formatDateRange(start, end);
  }

  // ── Datepicker header injection ──────────────────────────────────
  // ng-bootstrap's `<ngb-datepicker-navigation>` refuses to render in this
  // Angular 19 / ngb 17 combo even with `navigation="select"` and a valid
  // model. Instead of fighting that, we observe new pickers appearing in
  // the DOM and inject our own header (prev / month label / next) into the
  // empty `.ngb-dp-header`, wired directly to the picker's navigation methods.
  private pickerObserver?: MutationObserver;
  private formSubscription?: Subscription;
  private readonly attachedPickers = new WeakSet<HTMLElement>();
  private readonly handleOutsideClick = (event: MouseEvent): void => {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    // Don't close when the click is on the date inputs (those open the picker)
    // or anywhere inside the popped-up picker UI.
    if (target.closest('input[name="startDate"]') || target.closest('input[name="endDate"]')) {
      return;
    }
    if (target.closest('ngb-datepicker')) {
      return;
    }
    this.startPicker?.close();
    this.endPicker?.close();
  };

  ngOnInit(): void {
    this.formSubscription = this.form.valueChanges.subscribe(() => {
      this.syncDraftSignal();
    });

    this.pickerObserver = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach(node => {
          if (!(node instanceof HTMLElement)) return;
          const pickers = node.tagName.toLowerCase() === 'ngb-datepicker'
            ? [node]
            : Array.from(node.querySelectorAll('ngb-datepicker')) as HTMLElement[];
          pickers.forEach(p => this.attachHeader(p));
        });
      }
    });
    this.pickerObserver.observe(document.body, { childList: true, subtree: true });

    // ngb's autoClose="outside" isn't being honoured by the directive in this
    // version, so we run our own click-outside detector at the document level.
    document.addEventListener('mousedown', this.handleOutsideClick, true);
  }

  ngOnDestroy(): void {
    this.formSubscription?.unsubscribe();
    this.pickerObserver?.disconnect();
    document.removeEventListener('mousedown', this.handleOutsideClick, true);
  }

  ngAfterViewInit(): void {
    // `[restoreFocus]="false"` isn't honoured by NgbInputDatepicker in this version
    // (its config defaults to true and the template binding doesn't propagate), so
    // mutate the directive instances directly. Without this, closing one picker
    // yanks focus back to its own input — even when the user just clicked the
    // sibling — which strands the open picker over the wrong field.
    if (this.startPicker) (this.startPicker as { restoreFocus: boolean }).restoreFocus = false;
    if (this.endPicker) (this.endPicker as { restoreFocus: boolean }).restoreFocus = false;
  }

  private attachHeader(picker: HTMLElement): void {
    if (this.attachedPickers.has(picker)) return;
    this.attachedPickers.add(picker);

    // Defer one tick so Angular has populated the picker's component state.
    setTimeout(() => {
      const header = picker.querySelector('.ngb-dp-header');
      if (!header) return;

      const instance = (window as unknown as { ng?: { getComponent: (el: Element) => unknown } })
        .ng?.getComponent(picker) as PickerInstance | undefined;
      if (!instance) return;

      header.innerHTML = '';
      const nav = document.createElement('div');
      nav.className = 'nao-dp-nav';
      const prev = this.makeArrowBtn('prev', () => instance.onNavigateEvent?.(0));
      const label = document.createElement('span');
      label.className = 'nao-dp-nav-label';
      const next = this.makeArrowBtn('next', () => instance.onNavigateEvent?.(1));
      nav.append(prev, label, next);
      header.appendChild(nav);

      const render = () => {
        const d = instance.model?.firstDate;
        if (d) {
          const monthName = instance.i18n?.getMonthFullName?.(d.month, d.year) ?? '';
          label.textContent = monthName ? `${monthName} ${d.year}` : `${d.year}`;
        }
        // Mirror the picker's own prev/next-disabled state on the injected
        // buttons so the back arrow greys out at minDate, etc.
        const prevDisabled = !!instance.model?.prevDisabled;
        const nextDisabled = !!instance.model?.nextDisabled;
        prev.toggleAttribute('disabled', prevDisabled);
        next.toggleAttribute('disabled', nextDisabled);
        prev.setAttribute('aria-disabled', String(prevDisabled));
        next.setAttribute('aria-disabled', String(nextDisabled));
      };
      render();

      // The picker's service exposes a model stream — re-render on every change
      // so the label and the prev/next disabled state both stay in sync.
      const state$ = instance._service?.model$;
      const sub = state$?.subscribe?.(() => render());

      const cleanup = () => {
        sub?.unsubscribe?.();
        observer.disconnect();
      };
      const observer = new MutationObserver(() => {
        if (!document.body.contains(picker)) cleanup();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    });
  }

  private makeArrowBtn(direction: 'prev' | 'next', onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `nao-dp-nav-btn nao-dp-nav-btn--${direction}`;
    btn.setAttribute('aria-label', direction === 'prev' ? 'Previous month' : 'Next month');
    btn.innerHTML = `<span class="nao-dp-nav-chevron"></span>`;
    btn.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      onClick();
    });
    // Prevent the input's blur from closing the picker before the click registers.
    btn.addEventListener('mousedown', event => event.preventDefault());
    return btn;
  }

  protected get title(): string {
    return 'Work Order Details';
  }

  protected get submitLabel(): string {
    return this.mode() === 'edit' ? 'Save' : 'Create';
  }

  protected get isInvalid(): boolean {
    return this.form.invalid
      || this.endBeforeStart()
      || this.overlaps().length > 0;
  }

  protected save(): void {
    if (this.isInvalid) {
      return;
    }

    this.saved.emit({ ...this.toDraft(), name: this.form.controls.name.value.trim() });
  }

  private lastClosedAt = 0;
  /**
   * Open a picker — close the sibling first so only one calendar is ever
   * visible, and skip if a date was just selected (prevents the close→reopen flicker).
   *
   * ng-bootstrap's `restoreFocus` input isn't honoured reliably in this version,
   * so when the sibling picker closes it can yank focus back to its own input.
   * We snapshot whichever input was focused at click time and restore it on the
   * next tick — after ngb finishes its own focus dance.
   */
  protected openPicker(picker: NgbInputDatepicker): void {
    if (Date.now() - this.lastClosedAt < 250) {
      return;
    }
    // With `restoreFocus` disabled in `ngAfterViewInit`, close() no longer yanks
    // focus to the sibling input — it goes to <body>. Capture whichever input
    // the user just clicked and restore focus to it after the picker handoff.
    const focused = document.activeElement as HTMLElement | null;
    if (picker !== this.startPicker) this.startPicker?.close();
    if (picker !== this.endPicker) this.endPicker?.close();
    picker.open();
    if (focused && (focused.getAttribute('name') === 'startDate' || focused.getAttribute('name') === 'endDate')) {
      focused.focus();
    }
  }

  protected closePickerAfterSelect(): void {
    // ng-bootstrap's `(dateSelect)` doesn't always fire reliably in this
    // version, so form valueChanges handles the value, and this method only
    // deals with popup state.
    this.lastClosedAt = Date.now();
    this.startPicker?.close();
    this.endPicker?.close();
  }

  private syncDraftSignal(): void {
    this.draftSignal.set(this.toDraft());
  }

  private toDraft(): WorkOrderDrawerValue {
    const raw = this.form.getRawValue();
    return {
      ...(raw.id ? { id: raw.id } : {}),
      name: raw.name,
      workCenterId: raw.workCenterId,
      status: raw.status,
      startDate: raw.startDate ? this.toIsoDate(raw.startDate) : '',
      endDate: raw.endDate ? this.toIsoDate(raw.endDate) : '',
    };
  }

  private parseIsoDate(value: string): NgbDateStruct | null {
    if (!value) {
      return null;
    }

    const [year, month, day] = value.split('-').map(Number);
    return { year, month, day };
  }

  private toIsoDate(value: NgbDateStruct): string {
    return [
      value.year,
      `${value.month}`.padStart(2, '0'),
      `${value.day}`.padStart(2, '0'),
    ].join('-');
  }

  private emptyDraft(): WorkOrderDrawerValue {
    return {
      name: '',
      workCenterId: '',
      status: BadgeStatus.Open,
      startDate: '',
      endDate: '',
    };
  }
}
