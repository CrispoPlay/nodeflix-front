import { CommonModule }                         from '@angular/common';
import { Component, OnInit, computed, input, output, signal } from '@angular/core';
import { firstValueFrom }                        from 'rxjs';
import { LucideCirclePlay }                      from '@lucide/angular';
import { SerieDetail, SerieSummary }             from '../../core/models';
import { resolvePosterUrl }                      from '../../core/poster-url';
import { SeriesService }                         from '../../core/series.service';

@Component({
  selector: 'app-series-card',
  imports: [
    CommonModule,
    LucideCirclePlay
  ],
  templateUrl: './series-card.html'
})
export class SeriesCard implements OnInit {
  readonly serie = input.required<SerieSummary>();

  /** Emitido cuando el usuario hace clic en la tarjeta para abrir el modal */
  readonly viewDetails = output<SerieSummary>();

  readonly detail  = signal<SerieDetail | null>(null);
  readonly loading = signal(false);

  readonly rating = computed(() => {
    const value = this.detail()?.calificacion;
    return typeof value === 'number' ? value.toFixed(1) : null;
  });

  readonly genres = computed(() =>
    this.detail()?.generos?.map(g => g.name).slice(0, 3).join(' / ') ?? ''
  );

  readonly posterUrl = computed(() =>
    resolvePosterUrl(this.detail()?.poster ?? this.serie().poster)
  );

  constructor(private readonly series: SeriesService) {}

  ngOnInit(): void {
    // Si faltan datos básicos de la tarjeta, los pedimos en silencio al backend
    if (!this.posterUrl() || !this.rating() || !this.genres()) {
      void this.loadDetails();
    }
  }

  async loadDetails(): Promise<void> {
    if (this.detail() || this.loading()) return;
    this.loading.set(true);
    try {
      this.detail.set(
        await firstValueFrom(this.series.getDetalles(this.serie().id_tmdb))
      );
    } catch {
      this.detail.set(this.serie() as SerieDetail);
    } finally {
      this.loading.set(false);
    }
  }

  /** Clic en la tarjeta → propagar el evento hacia el BrowsePage */
  onCardClick(): void {
    this.viewDetails.emit(this.serie());
  }
}