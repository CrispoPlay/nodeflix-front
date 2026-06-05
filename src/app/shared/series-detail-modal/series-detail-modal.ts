import { CommonModule }                              from '@angular/common';
import {
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  computed,
  input,
  output,
  signal
}                                                     from '@angular/core';
import { DomSanitizer, SafeResourceUrl }              from '@angular/platform-browser';
import { firstValueFrom }                             from 'rxjs';
import {
  LucideCalendar,
  LucideHeart,
  LucideInfo,
  LucideMonitor,
  LucidePlus,
  LucideStar,
  LucideThumbsDown,
  LucideTriangleAlert,
  LucideX
}                                                     from '@lucide/angular';
import { InteractionType, Platform, SerieDetail, SerieSummary } from '../../core/models';
import { resolvePosterUrl }                           from '../../core/poster-url';
import { SeriesService }                              from '../../core/series.service';

@Component({
  selector: 'app-series-detail-modal',
  imports: [
    CommonModule,
    LucideCalendar,
    LucideHeart,
    LucideInfo,
    LucideMonitor,
    LucidePlus,
    LucideStar,
    LucideThumbsDown,
    LucideTriangleAlert,
    LucideX
  ],
  templateUrl: './series-detail-modal.html'
})
export class SeriesDetailModal implements OnInit, OnDestroy {
  /** Serie básica — el modal carga el detalle completo por su cuenta */
  readonly serie       = input.required<SerieSummary>();
  readonly close       = output<void>();
  readonly interaction = output<{ serie: SerieSummary; type: InteractionType }>();

  readonly detail     = signal<SerieDetail | null>(null);
  readonly loadingDetail = signal(true);
  readonly loadError  = signal(false);

  // ── Computados ────────────────────────────────────────────────────────────

  readonly posterUrl = computed(() =>
    resolvePosterUrl(this.detail()?.poster ?? this.serie().poster)
  );

  readonly trailerUrl = computed<SafeResourceUrl | null>(() => {
    const key = this.detail()?.youtube_key ?? this.serie().youtube_key;
    if (!key || !/^[\w-]+$/.test(key)) return null;
    return this.sanitizer.bypassSecurityTrustResourceUrl(
      `https://www.youtube.com/embed/${key}?rel=0&modestbranding=1&autoplay=0`
    );
  });

  readonly rating = computed(() => {
    const v = this.detail()?.calificacion;
    return typeof v === 'number' ? v.toFixed(1) : null;
  });

  readonly year = computed(() => {
    const date = this.detail()?.fecha_salida ?? this.serie().fecha_salida;
    return date ? date.slice(0, 4) : null;
  });

  readonly genres = computed(() =>
    this.detail()?.generos?.map(g => g.name) ?? []
  );

  readonly platforms = computed<Platform[]>(() => {
    const raw = this.detail()?.plataformas ?? this.serie().plataformas ?? [];
    return raw.slice(0, 6).map(p =>
      typeof p === 'string' ? { nombre: p as string } : p as Platform
    );
  });

  readonly description = computed(() =>
    this.detail()?.descripcion ?? this.serie().descripcion ?? null
  );

  // ── Constructor ───────────────────────────────────────────────────────────

  constructor(
    private readonly seriesService: SeriesService,
    private readonly sanitizer: DomSanitizer
  ) {}

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async ngOnInit(): Promise<void> {
    // Evitar scroll del body mientras el modal está abierto
    document.body.style.overflow = 'hidden';

    try {
      const d = await firstValueFrom(
        this.seriesService.getDetalles(this.serie().id_tmdb)
      );
      this.detail.set(d);
    } catch {
      this.loadError.set(true);
      // Usar los datos básicos que ya tenemos
      this.detail.set(this.serie() as SerieDetail);
    } finally {
      this.loadingDetail.set(false);
    }
  }

  ngOnDestroy(): void {
    document.body.style.overflow = '';
  }

  // ── Interacciones ─────────────────────────────────────────────────────────

  send(type: InteractionType, event?: Event): void {
    event?.stopPropagation();
    this.interaction.emit({ serie: this.serie(), type });
    this.close.emit();
  }

  // ── Keyboard ──────────────────────────────────────────────────────────────

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close.emit();
  }
}