# RoutePlanner Demo Site

Простой статический веб-интерфейс для демонстрации итогового проекта RoutePlanner.

## Запуск

Откройте `index.html` в браузере.

Никаких серверов и внешних зависимостей не требуется. Вся логика расчета находится в `app.js`:

- M/M/1 для задержек в узлах;
- Bellman-Ford;
- Dijkstra;
- проверка SLA;
- визуализация маршрута на SVG-графе.

## Демонстрационные сценарии

- `normal`: маршрут A → C → E → F, SLA выполняется;
- `peak`: маршрут A → C → E → F, SLA выполняется, но время близко к лимиту;
- `incident`: маршрут переключается на A → C → D → F, SLA нарушается.


<p align="center">
  <img
    src="https://github.com/user-attachments/assets/ca577ecc-35e7-4b37-8671-e75bacdd5d9b"
    alt="Главный экран демо-сайта"
    width="320"
  />
  <img
    src="https://github.com/user-attachments/assets/c14212aa-4256-4269-ab99-f901839adadb"
    alt="Результаты расчета маршрута"
    width="320"
  />
</p>
