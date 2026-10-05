# Meta App Review — ipoteka1-poster

Цель: Advanced Access к `instagram_business_manage_comments`, чтобы сервер видел
комментарии **всех** людей под постами @ipoteka1.kz_almaty / @ipoteka1.kz_astana
и отвечал номером хозяина именно той квартиры, под которой поставили «+».
Сейчас (Development mode) Instagram отдаёт комментарии только людей с ролью в
приложении, поэтому в директ уходит список номеров по последним постам.

Тексты для формы — по-английски (проверяющие читают английский). Пояснения
для нас — по-русски, курсивом в квадратных скобках их в форму не вставлять.

---

## 0. Что сделать до подачи

- [ ] **Business verification** в Meta Business Suite (документы ИП/ТОО, сайт). Без неё Advanced Access не дают.
- [ ] Заполнить заглушки на страницах (оператор данных, email):
      `ipoteka1/privacy/index.html`, `ipoteka1/data-deletion/index.html` — сейчас там «___@___».
- [ ] Тестовый аккаунт Instagram для проверяющих (обычный личный, НЕ наш бизнес-аккаунт), добавить его
      в приложение как **Instagram Tester** (App roles → Roles → Instagram Testers) и принять приглашение
      в настройках Instagram этого аккаунта. Так сценарий будет работать и до одобрения — и на видео, и у проверяющего.
- [ ] Иконка приложения 1024×1024 (логотип Ipoteka1), категория, контактный email.

## 1. Basic settings (App settings → Basic)

| Поле | Значение |
|---|---|
| App name | Ipoteka1 |
| App category | Business and pages |
| Privacy Policy URL | `https://reception365.online/ipoteka1/privacy/` *[или ipoteka1.kz, если домен подключён]* |
| User data deletion | Data deletion instructions URL: `https://reception365.online/ipoteka1/data-deletion/` |
| Contact email | *[ваш email]* |

## 2. Permissions to request

| Permission | Access | Зачем |
|---|---|---|
| `instagram_business_basic` | Advanced | обязательная база для остального; id и ник своего аккаунта |
| `instagram_business_manage_comments` | Advanced | читать комментарии всех пользователей под своими постами — главное |
| `instagram_business_content_publish` | Standard (уже есть) | публикуем только в свои аккаунты (у владельца есть роль) — Advanced не нужен |

Сообщения в директ отправляет **ManyChat** (их приложение уже одобрено Meta), поэтому
`instagram_business_manage_messages` мы **не** запрашиваем. Чем меньше разрешений — тем проще проверка.

---

## 3. Тексты для формы

### 3.1 `instagram_business_manage_comments` — «How will your app use this permission?»

```
Ipoteka1 is a real-estate listings service in Kazakhstan. We operate our own Instagram
professional accounts (@ipoteka1.kz_almaty and @ipoteka1.kz_astana). Each post is a
carousel about one apartment that the owner sells directly and that qualifies for a
bank mortgage. Every post carries a listing number on its cover (for example "№ 16").

Under each post we invite followers to comment "+" to receive the owner's contact for
that specific apartment. Our server uses instagram_business_manage_comments to read
the comments on our OWN posts (GET /{ig-media-id}/comments with fields id, text,
username, timestamp) and to find which post a person commented "+" under. The contact
for exactly that apartment is then sent to that person in a direct message.

Without this permission we cannot see which post the comment was left under, so we
would have to send the person a list of many apartments instead of the one they asked
for. Advanced Access is required because the people who comment are ordinary Instagram
users who have no role in our app.

We only read comments on media owned by our own accounts. We do not reply publicly,
hide or delete comments, and we do not read comments on any other accounts. We store
only the commenter's username, the post it was left under and the time of the request,
to avoid sending the same contact twice; these records are deleted after 12 months.
We never sell or share this data.
```

### 3.2 `instagram_business_basic` — «How will your app use this permission?»

```
instagram_business_basic lets our server identify our own Instagram professional
accounts (@ipoteka1.kz_almaty, @ipoteka1.kz_astana): we read the account id and username
(GET /me?fields=user_id,username) when the account is connected in our admin page, and
the list of our own media (GET /{ig-user-id}/media with fields id, caption, permalink,
timestamp) to match each published post with the apartment it describes. This is
required for instagram_business_manage_comments, which reads comments on these posts.
We do not access any other accounts or any data of people who are not our users.
```

### 3.3 Step-by-step instructions for the reviewer («How can the reviewer test it?»)

```
1. Open Instagram and log in with the test account provided below.
2. Open the profile @ipoteka1.kz_almaty and follow it.
3. Open any post. On the cover, top right, you will see the listing number (e.g. "№ 16").
4. Comment "+" under this post.
5. Within about a minute you will receive a direct message from @ipoteka1.kz_almaty with
   the owner's phone number for THIS apartment (the message repeats the listing number,
   room count, area and address of the post you commented on).
6. Comment "+" under a different post: the next message contains the contact for that
   other apartment only.

Test account: <username> / <password>
(If a login code is requested, contact us at <email>.)
```

### 3.4 Data handling questions (Data Use Checkup / Data handling)

```
Data processors / service providers with access to Platform Data:
- Microsoft Azure (hosting and database, region: West Europe)
- ManyChat (sends the direct message on our behalf; its own Meta-approved app)

Responsible entity: <ИП / ТОО name>, <address>, Kazakhstan
Country of the responsible entity: Kazakhstan
Requests from public authorities in the last 12 months: none
Policies for handling such requests: we disclose data only when required by the law of
Kazakhstan, after verifying the request, and only the minimum required.
```
*[Регион Azure проверить в портале — укажите тот, где реально живёт база.]*

---

## 4. Сценарий видео (screencast)

Требования Meta: видно всё действие от начала до конца, интерфейс по-английски
**или** с английскими субтитрами, без монтажа «из ниоткуда». Длина 2–4 минуты.
Писать с экрана телефона (запись экрана iOS/Android) или с двух устройств:
слева тестовый аккаунт, справа админ-страница. Субтитры ниже — наложить в любом редакторе.

| # | Что на экране | Субтитр (EN) |
|---|---|---|
| 1 | Админ-страница `/api/krisha/insta` в браузере, блок аккаунта @ipoteka1.kz_almaty «подключён» | `Ipoteka1 admin page: our own Instagram professional account @ipoteka1.kz_almaty is connected to the app.` |
| 2 | Лента @ipoteka1.kz_almaty в Instagram, открыть пост, крупно номер «№ N» на обложке | `Each post describes one apartment sold by its owner. The listing number is on the cover.` |
| 3 | Пролистать карусель до последнего слайда «Поставьте «+» в комментариях» | `We invite followers to comment "+" to get the owner's contact for this apartment.` |
| 4 | Переключиться на **тестовый аккаунт** (другой телефон или выйти/войти), подписаться на @ipoteka1.kz_almaty | `This is an ordinary Instagram user with no role in our business account.` |
| 5 | Тестовый аккаунт оставляет «+» под этим постом | `The user comments "+" under the post with listing № N.` |
| 6 | Админ-страница, таблица постов: у поста № N счётчик запросов номера вырос на 1 (обновить страницу) | `Our server reads comments on our own post (instagram_business_manage_comments) and sees which post the "+" was left under.` |
| 7 | Директ тестового аккаунта: пришло сообщение с номером хозяина, номером объявления № N, комнатами, адресом | `The user receives the owner's contact for exactly this apartment.` |
| 8 | Тестовый аккаунт ставит «+» под **другим** постом (№ M) → новое сообщение только по № M | `A "+" under another post returns the contact for that other apartment only.` |
| 9 | (необязательно) Показать страницу политики `/ipoteka1/privacy/` | `Privacy policy and data deletion instructions are published on our website.` |

Советы:
- Тестовый аккаунт должен быть **Instagram Tester** приложения — иначе до одобрения комментарий не будет виден серверу и шаг 6–7 не сработает.
- Перед записью проверить, что у обоих постов есть номер хозяина (страница показывает «номер есть»).
- Номера телефонов в кадре можно размыть — проверяющим достаточно видеть, что сообщение пришло и относится к нужному посту.
- Не показывать ключи, токены и строку адреса с `?key=` — обрезать или размыть.

## 5. После одобрения

1. App Dashboard → переключатель **Live**.
2. Проверить: «+» с постороннего аккаунта → в директ приходит одно объявление (а не список).
   Сервер переключится сам — список номеров отправляется, только когда комментарий не найден.
3. В ManyChat можно вернуть короткий текст сообщения (без перечня).
