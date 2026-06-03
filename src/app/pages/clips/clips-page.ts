import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { LucideArrowRight, LucideHeart, LucidePlay, LucidePlus, LucideStar, LucideThumbsDown } from '@lucide/angular';
import { InteractionType, SerieDetail } from '../../core/models';
import { OnboardingService } from '../../core/onboarding.service';

interface ClipView {
  serie: SerieDetail;
  videoUrl: SafeResourceUrl | null;
}

@Component({
  selector: 'app-clips-page',
  imports: [CommonModule, LucideArrowRight, LucideHeart, LucidePlay, LucidePlus, LucideStar, LucideThumbsDown],
  templateUrl: './clips-page.html'
})
export class ClipsPage implements OnInit {
  private readonly initialClipLimit = 9;
  private readonly loadMoreStep = 6;

  readonly clips = signal<ClipView[]>([]);
  readonly loading = signal(true);
  readonly loadingMore = signal(false);
  readonly hasMore = signal(true);
  readonly error = signal('');
  readonly moreError = signal('');
  readonly saving = signal(false);
  readonly selectedReactions = signal<Record<number, InteractionType>>({});

  constructor(
    private readonly onboarding: OnboardingService,
    private readonly sanitizer: DomSanitizer,
    private readonly router: Router
  ) {}

  async ngOnInit(): Promise<void> {
    try {
      this.onboarding.resetTrailerCandidates();
      const clips = await this.loadClipViews(this.initialClipLimit);
      this.clips.set(clips);
      this.hasMore.set(clips.length >= this.initialClipLimit);
    } catch {
      this.error.set('No se pudieron cargar clips desde el backend.');
    } finally {
      this.loading.set(false);
    }
  }

  async loadMore(): Promise<void> {
    if (this.loadingMore() || !this.hasMore()) {
      return;
    }

    this.moreError.set('');
    this.loadingMore.set(true);

    try {
      const current = this.clips();
      const desiredLimit = current.length + this.loadMoreStep;
      const expanded = await this.loadClipViews(desiredLimit);
      const existing = new Set(current.map((clip) => clip.serie.id_tmdb));
      const additions = expanded.filter((clip) => !existing.has(clip.serie.id_tmdb));

      if (additions.length) {
        this.clips.update((clips) => [...clips, ...additions]);
      }

      this.hasMore.set(expanded.length >= desiredLimit && additions.length > 0);
    } catch {
      this.moreError.set('No se pudieron cargar mas clips por ahora.');
    } finally {
      this.loadingMore.set(false);
    }
  }

  react(serie: SerieDetail, type: InteractionType): void {
    const current = this.selectedReactions()[serie.id_tmdb];
    const next = { ...this.selectedReactions() };

    if (current === type) {
      delete next[serie.id_tmdb];
    } else {
      next[serie.id_tmdb] = type;
    }

    this.selectedReactions.set(next);
  }

  selectedType(idTmdb: number): InteractionType | undefined {
    return this.selectedReactions()[idTmdb];
  }

  isSelected(idTmdb: number, type: InteractionType): boolean {
    return this.selectedType(idTmdb) === type;
  }

  selectedLabel(idTmdb: number): string {
    const labels: Partial<Record<InteractionType, string>> = {
      LE_GUSTA: 'Me gusta',
      ES_FAVORITA: 'Favorita',
      NO_LE_GUSTA: 'No me gusta'
    };

    return labels[this.selectedType(idTmdb) ?? 'LE_GUSTA'] ?? '';
  }

  formatGenres(serie: SerieDetail): string {
    return serie.generos?.map((genre) => genre.name).slice(0, 3).join(' / ') || 'Serie recomendada';
  }

  async continue(): Promise<void> {
    this.saving.set(true);
    try {
      for (const clip of this.clips()) {
        const type = this.selectedType(clip.serie.id_tmdb);
        if (type) {
          await this.onboarding.recordInteraction(clip.serie, type);
        }
      }

      await this.router.navigate(['/generos']);
    } finally {
      this.saving.set(false);
    }
  }

  private safeYoutubeUrl(key: string | null | undefined): SafeResourceUrl | null {
    if (!key || !/^[\w-]+$/.test(key)) {
      return null;
    }

    return this.sanitizer.bypassSecurityTrustResourceUrl(`https://www.youtube.com/embed/${key}?rel=0&modestbranding=1`);
  }

  private async loadClipViews(limit: number): Promise<ClipView[]> {
    const details = await this.onboarding.loadDetailedCandidates(limit);

    return details.map((serie) => ({
      serie,
      videoUrl: this.safeYoutubeUrl(serie.youtube_key)
    }));
  }
}
