import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

type ViewKey = 'orders' | 'articles' | 'products';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css'],
  standalone: true,
  imports: [CommonModule]
})
export class NavbarComponent {
  @Output() activeViewChange = new EventEmitter<ViewKey>();
  activeView: ViewKey = 'orders';

  setView(view: ViewKey): void {
    this.activeView = view;
    this.activeViewChange.emit(view);
  }
}
