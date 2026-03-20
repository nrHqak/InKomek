const features = [
  {
    title: '🗺 Умная навигация',
    text: 'маршруты под ваш тип инвалидности',
  },
  {
    title: '📷 Авто-репорт',
    text: 'ИИ фиксирует проблемы без вашего участия',
  },
  {
    title: '🆘 SOS',
    text: 'один нажим, помощь едет',
  },
  {
    title: '🤝 Волонтёры',
    text: 'живые люди рядом',
  },
  {
    title: '📳 Вибро-навигация',
    text: 'для людей с нарушением слуха',
  },
  {
    title: '✅ Верификация',
    text: 'проверенные места и бизнесы',
  },
]

const audience = [
  {
    title: '👁 Нарушение зрения',
    text: 'маршруты через переходы со светофором и тактильной плиткой',
  },
  {
    title: '🦽 Ограниченная мобильность',
    text: 'пути без уклонов и барьеров',
  },
  {
    title: '👂 Нарушение слуха',
    text: 'вибрация вместо звука',
  },
  {
    title: '👴 Пожилые люди',
    text: 'безопасные и комфортные маршруты',
  },
]

const plans = [
  {
    title: 'Стартер $29/мес',
    points: ['Листинг на карте', 'Базовый профиль', 'Неограниченные просмотры', '1 фото'],
    featured: false,
    cta: 'Купить Стартер',
  },
  {
    title: 'Про $79/мес',
    points: [
      'Всё из Стартера',
      'Accessibility Badge',
      'До 5 фото + видео тур',
      'Аналитика и статистика',
      'Приоритет в поиске',
    ],
    featured: true,
    cta: 'Купить Про',
  },
  {
    title: 'Премиум $199/мес',
    points: ['Всё из Про', 'Виджет на сайт', 'API доступ', 'ESG отчёт', 'Dedicated менеджер'],
    featured: false,
    cta: 'Купить Премиум',
  },
]

function App() {
  return (
    <>
      <a href="#content" className="skip-link">
        Перейти к содержимому
      </a>

      <main id="content">
        <section className="hero section" id="hero" aria-labelledby="hero-title">
          <div className="container">
            <div className="hero-layout">
              <div>
                <a className="logo" href="#hero" aria-label="InKomek">
                  <span aria-hidden="true">🌻</span>
                  <span>InKomek</span>
                </a>
                <h1 id="hero-title">Город для каждого</h1>
                <p className="hero-subtitle">
                  Первая платформа которая адаптирует маршрут под ваш тип инвалидности — автоматически
                </p>
                <div className="button-row">
                  <a className="btn btn-primary" href="#pricing">
                    Попробовать бесплатно
                  </a>
                  <a className="btn btn-outline" href="#how">
                    Узнать больше
                  </a>
                </div>
              </div>
              <div className="phone-mockup" aria-hidden="true">
                <div className="phone-frame">
                  <div className="phone-notch"></div>
                  <div className="phone-screen">
                    <div className="map-grid"></div>
                    <div className="map-pin pin-a"></div>
                    <div className="map-pin pin-b"></div>
                    <svg className="route-line" viewBox="0 0 260 420" preserveAspectRatio="none">
                      <path d="M24 360 C 80 320, 88 260, 126 236 C 172 208, 160 120, 228 84" />
                    </svg>
                    <div className="instruction-card">Через 50м поверните направо</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section section-dark" id="stats" aria-labelledby="stats-title">
          <div className="container">
            <h2 id="stats-title" className="section-title">
              Почему это важно
            </h2>
            <ul className="stats-grid">
              <li>
                <span className="stats-number">15%</span>
                <p>населения Казахстана живут с ограничениями</p>
              </li>
              <li>
                <span className="stats-number">73%</span>
                <p>боятся выходить на улицу одни</p>
              </li>
              <li>
                <span className="stats-number">0</span>
                <p>городов СНГ с реальной инклюзивной инфраструктурой</p>
              </li>
            </ul>
          </div>
        </section>

        <section className="section" id="how" aria-labelledby="how-title">
          <div className="container">
            <h2 id="how-title" className="section-title">
              Как это работает
            </h2>
            <div className="steps-grid">
              <article className="card">
                <span className="step-pill">1</span>
                <h3>Выберите тип инвалидности</h3>
              </article>
              <article className="card">
                <span className="step-pill">2</span>
                <h3>ИИ строит маршрут под вас</h3>
              </article>
              <article className="card">
                <span className="step-pill">3</span>
                <h3>Система следит автоматически</h3>
              </article>
              <article className="card">
                <span className="step-pill">4</span>
                <h3>Волонтёры рядом если нужна помощь</h3>
              </article>
            </div>
          </div>
        </section>

        <section className="section" id="features" aria-labelledby="features-title">
          <div className="container">
            <h2 id="features-title" className="section-title">
              Возможности
            </h2>
            <div className="features-grid">
              {features.map((item) => (
                <article className="card" key={item.title}>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section" id="audience" aria-labelledby="audience-title">
          <div className="container">
            <h2 id="audience-title" className="section-title">
              Для кого
            </h2>
            <div className="audience-grid">
              {audience.map((item) => (
                <article className="card" key={item.title}>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section" id="pricing" aria-labelledby="pricing-title">
          <div className="container">
            <h2 id="pricing-title" className="section-title">
              Тарифы
            </h2>
            <div className="pricing-grid">
              {plans.map((plan) => (
                <article className={`card pricing-card ${plan.featured ? 'popular' : ''}`} key={plan.title}>
                  {plan.featured ? <span className="badge">Популярный</span> : null}
                  <h3>{plan.title}</h3>
                  <ul>
                    {plan.points.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                  <a className={`btn ${plan.featured ? 'btn-primary' : 'btn-outline'}`} href="mailto:hello@inkomek.kz">
                    {plan.cta}
                  </a>
                </article>
              ))}
            </div>
            <div className="b2g">
              <p>
                <strong>Для города и государства</strong> — кастомное решение под ваши задачи
              </p>
              <a
                className="btn btn-primary"
                href="mailto:hello@inkomek.kz?subject=%D0%9E%D0%B1%D1%81%D1%83%D0%B4%D0%B8%D1%82%D1%8C%20%D0%BF%D1%80%D0%BE%D0%B5%D0%BA%D1%82"
              >
                Обсудить проект
              </a>
            </div>
          </div>
        </section>

        <section className="section cta" id="cta" aria-labelledby="cta-title">
          <div className="container">
            <h2 id="cta-title">Сделайте ваш город доступным сегодня</h2>
            <a className="btn btn-outline" href="#pricing">
              Начать бесплатно
            </a>
          </div>
        </section>
      </main>

      <footer className="footer" id="contacts">
        <div className="container footer-grid">
          <div>
            <p className="logo">
              <span aria-hidden="true">🌻</span>
              <span>InKomek</span>
            </p>
            <p>Инклюзивный город для каждого</p>
          </div>
          <ul className="footer-links">
            <li>
              <a href="#hero">О нас</a>
            </li>
            <li>
              <a href="#pricing">Тарифы</a>
            </li>
            <li>
              <a href="#features">Для бизнеса</a>
            </li>
            <li>
              <a href="mailto:hello@inkomek.kz">Контакты</a>
            </li>
          </ul>
        </div>
        <p className="footer-meta">hello@inkomek.kz | © 2025 InKomek</p>
      </footer>
    </>
  )
}

export default App
