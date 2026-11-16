(() => {
  'use strict';

  const photoStack = document.getElementById('photo-stack');
  const photoEmpty = document.getElementById('photo-empty');
  const personList = document.getElementById('person-list');
  const personTemplate = document.getElementById('person-template');
  const monthlyAmount = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 });

  function mapReturnLink(farm) {
    const mapUrl = new URL('index.html', location.href);
    const region = new URLSearchParams();
    if (farm.provinceCode) region.set('province', farm.provinceCode);
    if (farm.cityCode) region.set('city', farm.cityCode);
    if (farm.districtCode) region.set('district', farm.districtCode);
    region.set('farm', farm.id);
    mapUrl.hash = region.toString();
    return mapUrl.href;
  }

  function renderPhotos(photos) {
    photoEmpty.hidden = photos.length > 0;
    for (const photo of photos) {
      const frame = document.createElement('figure');
      frame.className = 'site-photo';
      const image = document.createElement('img');
      image.alt = photo.alt || photo.caption || '场地照片';
      image.addEventListener('load', () => { image.dataset.ready = ''; }, { once: true });
      image.addEventListener('error', () => {
        const empty = document.createElement('p');
        empty.className = 'photo-empty';
        empty.textContent = '场地图片暂时无法显示';
        image.replaceWith(empty);
      }, { once: true });
      image.src = photo.src;

      const caption = document.createElement('figcaption');
      caption.textContent = photo.caption || '场地照片';
      if (photo.example) {
        const badge = document.createElement('span');
        badge.className = 'photo-example';
        badge.textContent = '示意图';
        caption.append(badge);
      }
      frame.append(image, caption);
      photoStack.append(frame);
    }
  }

  function renderPeople(people) {
    document.getElementById('people-count').textContent = people.length + ' 人';
    document.getElementById('people-empty').hidden = people.length !== 0;
    for (const person of people) {
      const row = personTemplate.content.cloneNode(true);
      row.querySelector('[data-name]').textContent = person.name;
      const age = Number.isInteger(person.age) ? person.age + ' 岁' : '';
      const summary = [person.role, age].filter(Boolean).join(' · ');
      row.querySelector('[data-role-age]').textContent = summary || '资料待补充';
      row.querySelector('[data-pay]').textContent = Number.isFinite(person.monthlySalary)
        ? monthlyAmount.format(person.monthlySalary) + ' 元/月'
        : '待填写';
      row.querySelector('[data-work]').textContent = person.work || '待填写';
      personList.append(row);
    }
  }

  const id = new URLSearchParams(location.search).get('id') ?? 'JY-01';
  const farm = window.DEMO_FARMS.find(item => item.id === id);
  if (!farm) {
    document.getElementById('detail-unavailable').hidden = false;
    return;
  }
  const placeNames = window.DEMO_AREA_NAMES;
  const region = [farm.provinceCode, farm.cityCode, farm.districtCode]
    .map(code => placeNames[code])
    .filter(Boolean);
  document.title = farm.name + '｜养殖场详情';
  document.getElementById('return-to-map').href = mapReturnLink(farm);
  document.getElementById('detail-region').textContent = [...new Set(region)].join(' / ');
  document.getElementById('detail-title').textContent = farm.name;
  document.getElementById('detail-address').textContent = farm.address || '待填写';
  renderPhotos(farm.photos || []);
  renderPeople(window.DEMO_PEOPLE.filter(person => person.farmIds.includes(farm.id)));
  window.mountFarmOperations(farm);
  document.getElementById('farm-detail').hidden = false;
})();
