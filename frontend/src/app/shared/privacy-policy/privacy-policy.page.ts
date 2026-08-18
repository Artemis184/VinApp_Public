import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { Router } from '@angular/router';
import { NavigationService } from 'src/app/services/navigation.service';

@Component({
  selector: 'app-privacy-policy',
  templateUrl: './privacy-policy.page.html',
  styleUrls: ['./privacy-policy.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule],
})
export class PrivacyPolicyPage {
  private router = inject(Router);
  private navigationService = inject(NavigationService);

  goBack() {
    const previousUrl = this.navigationService.getPreviousUrl();
    this.router.navigate([previousUrl]);
  }
}
