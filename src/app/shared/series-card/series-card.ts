import { CommonModule } from '@angular/common';
import { Component, computed, input, output, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  LucideCirclePlay,
  LucideHeart,
  LucideInfo,
  LucidePlus,
  LucideStar,
  LucideThumbsDown
} from '@lucide/angular';
import { InteractionType, SerieDetail, SerieSummary } from '../../core/models';
import { SeriesService } from '../../core/series.service';

@Component({
  selector: 'app-series-card',
  imports: [CommonModule, LucideCirclePlay, LucideHeart, LucideInfo, LucidePlus, LucideStar, LucideThumbsDown],
  templateUrl: './series-card.html'
})
export class SeriesCard {
  readonly serie = input.required<SerieSummary>();
  readonly showActions = input(true);
  readonly interaction = output<{ serie: SerieSummary; type: InteractionType }>();

  readonly detail = signal<SerieDetail | null>(null);
  readonly loading = signal(false);

  readonly rating = computed(() => {
    const value = this.detail()?.calificacion;
    return typeof value === 'number' ? value.toFixed(1) : null;
  });

  readonly genres = computed(() => this.detail()?.generos?.map((genre) => genre.name).slice(0, 3).join(' / ') ?? '');

  constructor(private readonly series: SeriesService) {}

  async loadDetails(): Promise<void> {
    if (this.detail() || this.loading()) {
      return;
    }

    this.loading.set(true);
    try {
      this.detail.set(await firstValueFrom(this.series.getDetalles(this.serie().id_tmdb)));
    } catch {
      this.detail.set(this.serie() as SerieDetail);
    } finally {
      this.loading.set(false);
    }
  }

  send(event: Event, type: InteractionType): void {
    event.stopPropagation();
    this.interaction.emit({ serie: this.serie(), type });
  }
}
