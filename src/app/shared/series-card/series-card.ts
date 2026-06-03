import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, input, output, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
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
import { resolvePosterUrl } from '../../core/poster-url';
import { SeriesService } from '../../core/series.service';

@Component({
  selector: 'app-series-card',
  imports: [CommonModule, LucideCirclePlay, LucideHeart, LucideInfo, LucidePlus, LucideStar, LucideThumbsDown],
  templateUrl: './series-card.html'
})
export class SeriesCard implements OnInit {
  readonly serie = input.required<SerieSummary>();
  readonly showActions = input(true);
  readonly interaction = output<{ serie: SerieSummary; type: InteractionType }>();

  readonly detail = signal<SerieDetail | null>(null);
  readonly loading = signal(false);
  readonly previewRequested = signal(false);

  readonly rating = computed(() => {
    const value = this.detail()?.calificacion;
    return typeof value === 'number' ? value.toFixed(1) : null;
  });

  readonly genres = computed(() => this.detail()?.generos?.map((genre) => genre.name).slice(0, 3).join(' / ') ?? '');
  readonly posterUrl = computed(() => resolvePosterUrl(this.detail()?.poster ?? this.serie().poster));
  readonly previewUrl = computed(() => this.safeYoutubeUrl(this.detail()?.youtube_key ?? this.serie().youtube_key));
  readonly platforms = computed(() => this.resolvePlatforms());

  constructor(
    private readonly series: SeriesService,
    private readonly sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    if (!this.posterUrl()) {
      void this.loadDetails();
    }
  }

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

  async preparePreview(): Promise<void> {
    this.previewRequested.set(true);
    await this.loadDetails();
  }

  send(event: Event, type: InteractionType): void {
    event.stopPropagation();
    this.interaction.emit({ serie: this.serie(), type });
  }

  private safeYoutubeUrl(key: string | null | undefined): SafeResourceUrl | null {
    if (!key || !/^[\w-]+$/.test(key)) {
      return null;
    }

    return this.sanitizer.bypassSecurityTrustResourceUrl(
      `https://www.youtube.com/embed/${key}?autoplay=1&mute=1&controls=0&rel=0&modestbranding=1`
    );
  }

  private resolvePlatforms(): string[] {
    const explicit = this.detail()?.plataformas ?? this.serie().plataformas;
    if (explicit?.length) {
      return explicit.slice(0, 3);
    }

    const title = (this.detail()?.titulo ?? this.serie().titulo).toLowerCase();
    const platformHints: Array<[string, string[]]> = [
      ['one piece', ['Netflix', 'Crunchyroll']],
      ['attack on titan', ['Crunchyroll', 'Hulu']],
      ['demon slayer', ['Crunchyroll', 'Netflix']],
      ['jujutsu kaisen', ['Crunchyroll']],
      ['naruto', ['Crunchyroll', 'Netflix']],
      ['death note', ['Netflix', 'Crunchyroll']],
      ['dragon ball', ['Crunchyroll']],
      ['game of thrones', ['Max']],
      ['house of the dragon', ['Max']],
      ['the witcher', ['Netflix']],
      ['the sandman', ['Netflix']],
      ['shadow and bone', ['Netflix']],
      ['the wheel of time', ['Prime Video']],
      ['the rings of power', ['Prime Video']]
    ];

    return platformHints.find(([needle]) => title.includes(needle))?.[1] ?? [];
  }
}
