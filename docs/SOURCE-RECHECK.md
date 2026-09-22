# Повторная проверка пунктов и источников

Дата: 2026-09-22T16:30:33.432844+03:00

Меню сверено свежим запросом с https://zhat.ru/: все 79 названий, адресов и принадлежность к шести разделам совпадают. Все ссылки #/page/ в импортированных материалах имеют запись в локальном каталоге.

| Раздел | Пунктов |
|---|---:|
| Сведения об образовательной организации | 21 |
| Абитуриенту | 14 |
| Студенту | 18 |
| Выпускнику | 8 |
| Педагогу | 6 |
| Проекты | 12 |

## Ошибки страниц источника

- https://zhat.ru/abitur — HTTP Error 500: Internal Server Error
- https://zhat.ru/abitur/rejting-srednego-balla-attestata — HTTP Error 404: Not Found
- https://zhat.ru/projects — HTTP Error 500: Internal Server Error

## Неопубликованное содержимое

- https://zhat.ru/sveden/pitanie
- https://zhat.ru/abitur/informatsiya-o-rezultatakh-prijoma-na-2025-2026-uchebnyj-god
- https://zhat.ru/abitur/obrazovatelnoe-kreditovanie
- https://zhat.ru/projects/dpo

## Файлы и внешние сервисы

Повторно проверены 620 уникальных ссылок на файлы и медиа ЖАТ: 600 отвечают успешно, 20 возвращают ошибки. Подробности — [матрица разделов](SECTION-COVERAGE.md).

Дополнительно проверены 80 внешних адресов из содержимого страниц: 63 отвечают успешно, 17 не удалось подтвердить после повторного запроса. Ошибки 403, TLS и таймауты не доказывают недоступность сервиса в обычном браузере. Кириллические домены проверены в IDNA-представлении.

| Внешний адрес | Результат запроса |
|---|---|
| `http://fcior.edu.ru` | <urlopen error [Errno 8] nodename nor servname provided, or not known> |
| `http://school- collection.edu.ru` | URL can't contain control characters. 'school- collection.edu.ru' (found at least ' ') |
| `http://vinaora.com/` | The read operation timed out |
| `http://window.edu.ru` | <urlopen error [Errno 8] nodename nor servname provided, or not known> |
| `http://www.edu.ru` | timed out |
| `http://www.job.ru/seeker/job/` | HTTP Error 404: Not Found |
| `http://фжат.рф/` | HTTP Error 503: Service Unavailable |
| `https://cub.iro.perm.ru/download/4143` | HTTP Error 403: Forbidden |
| `https://disk.yandex.ru/d/cA6U5ZEmN9SlFA` | HTTP Error 404: Not Found |
| `https://docs.google.com/forms/d/1IgJlw1y-OR_YrmjlysAkvGCAKIHdkpsoqxLAFdNchIU/viewform?edit_requested=true` | HTTP Error 404: Not Found |
| `https://e-learning.tspk-mo.ru/` | <urlopen error _ssl.c:1011: The handshake operation timed out> |
| `https://edu.gov.ru/` | <urlopen error [SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed: self-signed certificate in certificate chain (_ssl.c:1028)> |
| `https://max.ru/join/DyxRwl-0LcNwjpi4f4-0OUygfr6acJ2Rn_u7sFyJvjw` | <urlopen error [SSL: UNEXPECTED_EOF_WHILE_READING] EOF occurred in violation of protocol (_ssl.c:1028)> |
| `https://psy.edu.ru` | <urlopen error [SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed: unable to get local issuer certificate (_ssl.c:1028)> |
| `https://www.rabota.ru/` | HTTP Error 403: Forbidden |
| `https://www.trud.com/` | HTTP Error 403: Forbidden |
| `https://zakupki.gov.ru/epz/organization/view/info.html?organizationId=710140` | <urlopen error [SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed: self-signed certificate in certificate chain (_ssl.c:1028)> |

## Границы проверки

Проверены состав меню, адреса, наличие локальных материалов и доступность ресурсов по HTTP. Содержание каждого PDF, юридическая актуальность документов и отправка внешних форм не проверялись. Найденные внешние адреса сохранены как в источнике, без догадок о замене.

Исправлена обработка служебных ссылок «#»: заголовки раскрывающихся блоков больше не получают ошибочную пометку отсутствующего скачивания. Материалы синхронизированы заново. Сборка, 12 проверок содержимого и 4 проверки упаковки прошли.
