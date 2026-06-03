import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { LucideArrowRight, LucideCheck, LucideClapperboard } from '@lucide/angular';
import { GENRE_OPTIONS } from '../../core/catalog';
import { GenreOption } from '../../core/models';
import { OnboardingService } from '../../core/onboarding.service';

@Component({
  selector: 'app-genre-page',
  imports: [CommonModule, LucideArrowRight, LucideCheck, LucideClapperboard],
  templateUrl: './genre-page.html'
})
export class GenrePage {
  readonly genres = GENRE_OPTIONS;

  constructor(
    readonly onboarding: OnboardingService,
    private readonly router: Router
  ) {}

  isSelected(genre: GenreOption): boolean {
    return this.onboarding.selectedGenres().some((item) => item.id === genre.id);
  }

  toggle(genre: GenreOption): void {
    this.onboarding.toggleGenre(genre);
  }

  async continue(): Promise<void> {
    await this.router.navigate(['/caratulas']);
  }
}
