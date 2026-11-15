import { Component, OnInit } from '@angular/core';
import { appLogger } from 'src/app/core/logger.service';

@Component({
  selector: 'app-user-menu',
  templateUrl: './user-menu.component.html',
  styleUrls: ['./user-menu.component.scss'],
})
export class UserMenuComponent implements OnInit {
  constructor() {}

  ngOnInit(): void {
    appLogger.log('UserMenuComponent inicializado');
  }
}
