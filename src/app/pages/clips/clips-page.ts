import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { LucideArrowRight, LucideHeart, LucidePlay, LucideStar, LucideThumbsDown } from '@lucide/angular';
import { InteractionType, SerieDetail } from '../../core/models';
import { OnboardingService } from '../../core/onboarding.service';

interface ClipView {
  serie: SerieDetail;
  videoUrl: SafeResourceUrl | null;
}

@Component({
  selector: 'app-clips-page',
  imports: [CommonModule, LucideArrowRight, LucideHeart, LucidePlay, LucideStar, LucideThumbsDown],
  templateUrl: './clips-page.html'
})
export class ClipsPage implements OnInit {
  readonly clips = signal<ClipView[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly busyIds = signal<number[]>([]);
  readonly touchedIds = signal<number[]>([]);

  constructor(
    private readonly onboarding: OnboardingService,
    private readonly sanitizer: DomSanitizer,
    private readonly router: Router
  ) {}

  async ngOnInit(): Promise<void> {
    try {
      const details = await this.onboarding.loadDetailedCandidates(6);
      this.clips.set(
        details.map((serie) => ({
          serie,
          videoUrl: this.safeYoutubeUrl(serie.youtube_key)
        }))
      );
    } catch {
      this.error.set('No se pudieron cargar clips desde el backend.');
    } finally {
      this.loading.set(false);
    }
  }

  async react(serie: SerieDetail, type: InteractionType): Promise<void> {
    if (this.busyIds().includes(serie.id_tmdb)) {
      return;
    }

    this.busyIds.set([...this.busyIds(), serie.id_tmdb]);
    try {
      await this.onboarding.recordInteraction(serie, type);
      this.touchedIds.set(Array.from(new Set([...this.touchedIds(), serie.id_tmdb])));
    } finally {
      this.busyIds.set(this.busyIds().filter((id) => id !== serie.id_tmdb));
    }
  }

  isTouched(idTmdb: number): boolean {
    return this.touchedIds().includes(idTmdb) || this.onboarding.touchedSeries().includes(idTmdb);
  }

  formatGenres(serie: SerieDetail): string {
    return serie.generos?.map((genre) => genre.name).slice(0, 3).join(' / ') || 'Serie recomendada';
  }

  async continue(): Promise<void> {
    await this.router.navigate(['/caratulas']);
  }

  private safeYoutubeUrl(key: string | null | undefined): SafeResourceUrl | null {
    if (!key || !/^[\w-]+$/.test(key)) {
      return null;
    }

    return this.sanitizer.bypassSecurityTrustResourceUrl(`https://www.youtube.com/embed/${key}?rel=0&modestbranding=1`);
  }
}
