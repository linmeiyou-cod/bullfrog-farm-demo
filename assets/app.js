(() => {
  'use strict';

  const NATIONAL = '100000';
  const china = window.MAP_GEO[NATIONAL];
  const cityAssets = new Set(window.MAP_CITY_CODES);
  const operations = window.FrogOperations;
  const farmsByRegion = new Map();
  for (const farm of window.DEMO_FARMS) {
    // A city can also be a province-level division. Count it once per region.
    const codes = new Set([NATIONAL, farm.provinceCode, farm.cityCode, farm.districtCode]);
    for (const code of codes) {
      if (!code) continue;
      if (!farmsByRegion.has(code)) farmsByRegion.set(code, []);
      farmsByRegion.get(code).push(farm);
    }
  }
  const provinceAbbreviations = {
    '150000': '内蒙古', '450000': '广西', '540000': '西藏', '640000': '宁夏',
    '650000': '新疆', '810000': '香港', '820000': '澳门',
  };
  const style = getComputedStyle(document.documentElement);
  const demoColor = style.getPropertyValue('--chart-demo').trim();
  const selectedColor = style.getPropertyValue('--chart-selection').trim();
  const neutralColor = style.getPropertyValue('--chart-neutral').trim();
  const fontFamily = style.getPropertyValue('--type').trim();
  const motionEasing = style.getPropertyValue('--motion-ease').trim();
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const coarsePointer = matchMedia('(pointer: coarse)');
  const provinceSelect = document.getElementById('province');
  const citySelect = document.getElementById('city');
  const districtSelect = document.getElementById('district');
  const breadcrumbs = document.getElementById('breadcrumbs');
  const back = document.getElementById('back');
  const status = document.getElementById('map-status');
  const stage = document.getElementById('map-stage');
  const mapElement = document.getElementById('map');
  const seaInset = document.getElementById('sea-inset');
  const farmCount = document.getElementById('farm-count');
  const farmResults = document.getElementById('farm-results');
  const farmList = document.getElementById('farm-list');
  const farmEmpty = document.getElementById('farm-empty');
  const examples = [...document.querySelectorAll('.sample')];
  const pendingAssets = new Map();
  const registered = new Map();

  let chart;
  let seaChart;
  let state;
  let mapMotion;
  let listMotion;
  let requestNumber = 0;
  let loading = false;

  function codeOf(feature) {
    return String(feature.properties.adcode);
  }

  function nameOf(feature) {
    return feature.properties.name;
  }

  function collection(features) {
    return { type: 'FeatureCollection', features };
  }

  function childRegions(geo, level) {
    return geo.features.filter(feature => feature.properties.level === level && nameOf(feature));
  }

  function fetchRegion(code) {
    if (window.MAP_GEO[code]) return Promise.resolve(window.MAP_GEO[code]);
    if (!pendingAssets.has(code)) {
      const script = document.createElement('script');
      script.src = 'assets/maps/' + code + '.js';
      const asset = new Promise((resolve, reject) => {
        script.onload = () => {
          if (window.MAP_GEO[code]) resolve(window.MAP_GEO[code]);
          else reject(new Error('Empty map: ' + code));
        };
        script.onerror = () => reject(new Error('Missing map: ' + code));
        document.head.append(script);
      }).finally(() => {
        script.remove();
        pendingAssets.delete(code);
      });
      pendingAssets.set(code, asset);
    }
    return pendingAssets.get(code);
  }

  function landAndSea() {
    const land = [];
    for (const feature of china.features) {
      const code = codeOf(feature);
      if (code === '100000_JD') continue;
      // Keep Hainan island on the main map. The southern islands and
      // maritime line are shown with their original geometry in the inset.
      if (code === '460000' && feature.geometry.type === 'MultiPolygon') {
        const coordinates = feature.geometry.coordinates.filter(polygon => polygon[0].some(point => point[1] >= 17));
        land.push({ ...feature, geometry: { ...feature.geometry, coordinates } });
      } else {
        land.push(feature);
      }
    }
    return collection(land);
  }

  function getRegisteredMap(key, geo) {
    if (registered.has(key)) return registered.get(key);
    const bounds = [Infinity, Infinity, -Infinity, -Infinity];
    function extend(node) {
      if (typeof node[0] === 'number') {
        const [x, y] = node;
        bounds[0] = Math.min(bounds[0], x);
        bounds[1] = Math.min(bounds[1], y);
        bounds[2] = Math.max(bounds[2], x);
        bounds[3] = Math.max(bounds[3], y);
      } else {
        node.forEach(extend);
      }
    }

    const byCode = new Map();
    const features = geo.features.map(feature => {
      extend(feature.geometry.coordinates);
      const code = codeOf(feature);
      byCode.set(code, feature);
      return { ...feature, properties: { ...feature.properties, name: code } };
    });
    echarts.registerMap(key, collection(features));
    const entry = { bounds, byCode };
    registered.set(key, entry);
    return entry;
  }

  function nationalView() {
    return {
      key: NATIONAL,
      geo: land,
      level: '省级分布',
      title: '中国地图',
      province: '',
      city: '',
      district: '',
      cities: [],
      districts: [],
      trail: [{ title: '全国', route: [] }],
    };
  }

  async function makeView(province, city, district) {
    if (!province) return nationalView();
    const provinceFeature = provinces.find(item => codeOf(item) === province);
    if (!provinceFeature) return nationalView();

    const provincial = await fetchRegion(province);
    const provinceName = nameOf(provinceFeature);
    const cities = childRegions(provincial, 'city');
    const directDistricts = childRegions(provincial, 'district');
    const trail = [{ title: '全国', route: [] }, { title: provinceName, route: [province] }];
    const view = {
      key: province,
      geo: provincial,
      level: directDistricts.length ? '区县分布' : '市级分布',
      title: provinceName,
      province,
      city: '',
      district: '',
      cities,
      districts: directDistricts,
      trail,
    };

    const cityFeature = cities.find(item => codeOf(item) === city);
    if (cityFeature) {
      view.key = city;
      view.city = city;
      view.title = nameOf(cityFeature);
      view.level = '区县分布';
      view.geo = cityAssets.has(city) ? await fetchRegion(city) : collection([cityFeature]);
      view.districts = childRegions(view.geo, 'district');
      trail.push({ title: view.title, route: [province, city] });
    }
    if (!cities.length && !directDistricts.length) view.level = '省级轮廓';
    if (view.city && !view.districts.length) view.level = '城市轮廓';

    const districtFeature = view.districts.find(item => codeOf(item) === district);
    if (districtFeature) {
      view.district = district;
      trail.push({ title: nameOf(districtFeature), route: [province, view.city, district] });
    }
    return view;
  }

  function fillSelect(select, features, value, placeholder) {
    const options = [new Option(placeholder, '')];
    for (const feature of features) options.push(new Option(nameOf(feature), codeOf(feature)));
    select.replaceChildren(...options);
    select.value = value;
    select.disabled = !features.length;
  }

  function renderControls(view) {
    provinceSelect.value = view.province;
    let cityHint = view.province ? '请选择城市' : '先选省份';
    if (view.province && !view.cities.length) cityHint = view.districts.length ? view.title : '暂无城市';
    const districtHint = view.districts.length ? '请选择区县'
      : view.city || (view.province && !view.cities.length) ? '暂无区县' : '先选城市';
    fillSelect(citySelect, view.cities, view.city, cityHint);
    fillSelect(districtSelect, view.districts, view.district, districtHint);

    const crumbs = [];
    view.trail.forEach((step, index) => {
      const crumb = document.createElement('span');
      crumb.className = 'crumb';
      if (index) {
        const separator = document.createElement('span');
        separator.className = 'separator';
        separator.textContent = '/';
        separator.setAttribute('aria-hidden', 'true');
        crumb.append(separator);
      }
      const isCurrent = index === view.trail.length - 1;
      const item = document.createElement(isCurrent ? 'span' : 'button');
      item.textContent = step.title;
      if (isCurrent) item.setAttribute('aria-current', 'page');
      else {
        item.type = 'button';
        item.addEventListener('click', () => navigate(...step.route));
      }
      crumb.append(item);
      crumbs.push(crumb);
    });
    breadcrumbs.replaceChildren(...crumbs);
    back.hidden = view.trail.length < 2;
    document.getElementById('map-level').textContent = view.district ? '已选区县' : view.level;
    document.getElementById('map-title').textContent = view.district ? view.trail.at(-1).title : view.title;
    document.getElementById('selected-legend').hidden = !view.district;
    for (const button of examples) button.setAttribute('aria-pressed', String(button.dataset.city === view.city));
  }

  function farmsFor(code) {
    return farmsByRegion.get(code) || [];
  }

  function renderFarms(view) {
    const code = view.district || view.city || view.province || NATIONAL;
    const farms = farmsFor(code);
    farmCount.textContent = farms.length;

    const showList = Boolean(view.district || (view.city && !view.districts.length));
    farmResults.hidden = !showList;
    farmEmpty.hidden = farms.length > 0;
    if (!showList) {
      farmList.replaceChildren();
      return;
    }

    farmList.replaceChildren(...farms.map(farm => {
      const item = document.createElement('li');
      item.className = 'farm-item';
      const link = document.createElement('a');
      link.className = 'farm-link';
      link.dataset.farmId = farm.id;
      link.href = 'farm.html?id=' + encodeURIComponent(farm.id);
      const name = document.createElement('strong');
      name.textContent = farm.name;
      const nameRow = document.createElement('div');
      nameRow.className = 'farm-name-row';
      const badge = document.createElement('span');
      badge.className = 'farm-grade';
      operations.setGradeBadge(badge, operations.readFarm(farm.id).grade);
      nameRow.append(name, badge);
      const address = document.createElement('span');
      address.className = 'farm-address';
      address.textContent = farm.address;
      link.append(nameRow, address);
      item.append(link);
      return item;
    }));
  }

  function refreshFarmGrades() {
    for (const link of farmList.querySelectorAll('.farm-link')) {
      operations.setGradeBadge(link.querySelector('.farm-grade'), operations.readFarm(link.dataset.farmId).grade);
    }
  }

  function labelText(feature, level) {
    const name = nameOf(feature);
    if (level === '省级分布') return provinceAbbreviations[codeOf(feature)] || name.replace(/[省市]$/, '');
    return level === '市级分布' ? name.replace(/市$/, '') : name;
  }

  function paint(view) {
    const { bounds, byCode } = getRegisteredMap(view.key, view.geo);
    const width = chart.getWidth();
    const height = chart.getHeight();
    const narrow = width < 520;
    const showTooltip = !narrow && !coarsePointer.matches;
    const national = view.key === NATIONAL;
    const [west, south, east, north] = bounds;
    const aspectScale = Math.cos((south + north) * Math.PI / 360);
    const ratio = (east - west) * aspectScale / (north - south);
    const top = narrow ? 49 : (national ? 34 : 53);
    const bottom = narrow || national ? 35 : 36;
    const availableHeight = Math.max(1, height - (top + bottom));
    const availableWidth = Math.max(1, width - (narrow ? 15 : 56));
    const extent = Math.min(availableWidth, availableHeight * ratio);
    const labels = [];
    const regions = [];

    for (const [code, feature] of byCode) {
      if (!nameOf(feature)) continue;
      const selected = view.district === code;
      const count = farmsFor(code).length;
      const lit = count > 0;
      const paintColor = selected ? selectedColor : lit ? demoColor : neutralColor;
      const borderColor = selected ? '#fff0c1' : lit ? '#39836b' : '#91b1a17a';
      const hoverColor = selected ? '#ffe5a4' : lit ? '#a0eac6' : '#426f69';
      regions.push({
        name: code,
        itemStyle: { areaColor: paintColor, borderColor },
        emphasis: { itemStyle: { areaColor: hoverColor, borderColor: '#c0e3cf', borderWidth: 1.2 } },
        tooltip: { formatter: nameOf(feature) + '\n' + count + ' 个养殖场' },
      });
      const point = feature.properties.centroid || feature.properties.center;
      const tinyNationalRegion = national && ['110000', '120000', '310000', '810000', '820000'].includes(code);
      if (!point || tinyNationalRegion) continue;
      const caption = labelText(feature, view.level);
      labels.push({
        name: code,
        value: point,
        caption: view.level === '区县分布' && (lit || selected) ? caption + ' · ' + count : caption,
        label: {
          color: lit || selected ? '#123a2c' : '#d1e5da',
          fontWeight: lit || selected ? 700 : 500,
          textBorderColor: lit || selected ? paintColor : '#183a39',
          textBorderWidth: lit || selected ? 1.8 : 1.2,
        },
      });
    }

    chart.setOption({
      animation: false,
      textStyle: { fontFamily },
      tooltip: {
        trigger: 'item',
        triggerOn: 'mousemove',
        show: showTooltip,
        confine: true,
        renderMode: 'richText',
        backgroundColor: '#f4fbf5',
        borderColor: '#b1cdbb',
        textStyle: { color: '#234137', fontFamily, fontSize: 13 },
      },
      geo: {
        map: view.key,
        layoutCenter: [width * 0.5, top + availableHeight * 0.5],
        layoutSize: Math.max(extent, extent / ratio),
        aspectScale,
        roam: false,
        label: { show: false },
        tooltip: { show: showTooltip },
        itemStyle: { areaColor: neutralColor, borderWidth: narrow ? 0.75 : 1.05 },
        emphasis: { label: { show: false } },
        regions,
      },
      series: [{
        type: 'scatter',
        coordinateSystem: 'geo',
        z: 4,
        silent: true,
        tooltip: { show: false },
        symbolSize: 1,
        itemStyle: { color: 'transparent' },
        label: {
          show: true,
          position: 'inside',
          fontSize: narrow ? (national ? 8.5 : 10) : (national ? 12 : 13),
          fontFamily,
          formatter: params => params.data.caption,
        },
        labelLayout: { hideOverlap: true },
        data: labels,
      }],
    }, { notMerge: true });
    seaInset.hidden = !national;
    if (national) paintSea();
  }

  function paintSea() {
    const key = 'south-china-sea';
    if (!seaChart) {
      const seaboardCodes = new Set(['450000', '440000', '350000', '460000', '710000', '100000_JD']);
      const seaboard = china.features.filter(feature => seaboardCodes.has(codeOf(feature)));
      getRegisteredMap(key, collection(seaboard));
      seaChart = echarts.init(document.getElementById('sea-chart'));
      seaChart.setOption({
        animation: false,
        geo: {
          map: key,
          boundingCoords: [[106.6, 24.7], [124.5, 2.5]],
          layoutCenter: ['50%', '51%'],
          layoutSize: '91%',
          aspectScale: 0.96,
          silent: true,
          itemStyle: { areaColor: '#508075', borderColor: '#a0c5b7', borderWidth: 0.35 },
          regions: [{ name: '100000_JD', itemStyle: { areaColor: '#c9e6d7', borderWidth: 0.35 } }],
        },
      });
    } else {
      seaChart.resize();
    }
  }

  function setStatus(message) {
    status.textContent = message;
    status.hidden = !message;
  }

  function show(view) {
    state = view;
    renderControls(view);
    renderFarms(view);
    paint(view);
  }

  function stopMapMotion() {
    if (!mapMotion) return;
    const { frame, outgoing, incoming } = mapMotion;
    mapMotion = null;
    frame.remove();
    outgoing.cancel();
    incoming?.cancel();
  }

  function captureMapMotion(view) {
    stopMapMotion();
    if (!state || reducedMotion.matches || !mapElement.animate || !mapElement.clientWidth) return null;
    const levelChanged = state.key !== view.key;
    if (!levelChanged && state.district === view.district) return null;

    const currentRegions = registered.get(state.key).byCode;
    const target = levelChanged
      ? currentRegions.get(view.key) || (state.key === NATIONAL && currentRegions.get(view.province))
      : null;
    const point = target && (target.properties.centroid || target.properties.center);
    const anchor = point && chart.convertToPixel({ geoIndex: 0 }, point);
    const zoom = target ? (chart.getWidth() < 520 ? 1.08 : 1.12)
      : levelChanged && (view.key === NATIONAL || view.key === state.province) ? 0.96 : 1;

    chart.dispatchAction({ type: 'hideTip' });
    if (target) {
      const glow = { areaColor: '#b5efcd', borderColor: '#e9fff0', borderWidth: 1.65 };
      const regions = chart.getOption().geo[0].regions.map(region => region.name === codeOf(target)
        ? { ...region, itemStyle: glow, emphasis: { itemStyle: glow } }
        : region);
      chart.setOption({ geo: { regions } });
    }

    // Preserve the outgoing canvas while the new region is drawn underneath.
    const source = chart.renderToCanvas({ pixelRatio: Math.min(devicePixelRatio || 1, 1.5) });
    const frame = document.createElement('canvas');
    frame.className = 'map-motion-frame';
    frame.setAttribute('aria-hidden', 'true');
    frame.width = source.width;
    frame.height = source.height;
    const context = frame.getContext('2d');
    if (!context) return null;
    context.drawImage(source, 0, 0);
    if (anchor && anchor.every(Number.isFinite)) {
      frame.style.transformOrigin = anchor[0] + 'px ' + anchor[1] + 'px';
    }
    return { frame, levelChanged, zoom };
  }

  function playMapMotion(snapshot) {
    if (!snapshot) return;
    const { frame, levelChanged, zoom } = snapshot;
    const timing = { duration: levelChanged ? 220 : 150, easing: motionEasing };
    stage.append(frame);
    const outgoing = frame.animate([
      { opacity: 1, transform: 'scale(1)' },
      { opacity: 1, transform: 'scale(' + (1 + (zoom - 1) * 0.45) + ')', offset: 0.24 },
      { opacity: 0, transform: 'scale(' + zoom + ')' },
    ], timing);
    const incoming = levelChanged ? mapElement.animate([
      { opacity: 0 },
      { opacity: 0.12, offset: 0.23 },
      { opacity: 1 },
    ], timing) : null;

    mapMotion = { frame, outgoing, incoming };
    const removeFrame = () => {
      frame.remove();
      if (mapMotion?.frame === frame) mapMotion = null;
    };
    outgoing.finished.then(removeFrame, removeFrame);
  }

  function revealFarmList() {
    listMotion?.cancel();
    if (farmResults.hidden || reducedMotion.matches || !farmResults.animate) return;
    listMotion = farmResults.animate([
      { opacity: 0.22, transform: 'translateY(4px)' },
      { opacity: 1, transform: 'translateY(0)' },
    ], { duration: 155, easing: motionEasing });
  }

  function restoreFarmLink(farmId) {
    const link = [...farmList.querySelectorAll('.farm-link')].find(item => item.dataset.farmId === farmId);
    if (!link) return;
    link.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    link.focus({ preventScroll: true });
    if (reducedMotion.matches || !link.animate) return;
    mapElement.animate([{ opacity: 0.68 }, { opacity: 1 }], { duration: 170, easing: motionEasing });
    link.animate([{ backgroundColor: '#d5ecda' }, { backgroundColor: 'transparent' }], {
      duration: 230, easing: motionEasing,
    });
  }

  function updateMapAddress(view) {
    const route = new URLSearchParams();
    if (view.province) route.set('province', view.province);
    if (view.city) route.set('city', view.city);
    if (view.district) route.set('district', view.district);
    const url = new URL(location.href);
    url.hash = route.toString();
    if (url.href !== location.href) history.replaceState(null, '', url);
  }

  async function navigate(province = '', city = '', district = '', returnFarm = '') {
    const ticket = ++requestNumber;
    loading = true;
    stage.setAttribute('aria-busy', 'true');
    const delay = setTimeout(() => {
      if (ticket === requestNumber) setStatus('正在加载地图…');
    }, 150);
    try {
      const view = await makeView(province, city, district);
      if (ticket !== requestNumber) return;
      const scopeChanged = state && (view.key !== state.key || view.district !== state.district);
      const snapshot = captureMapMotion(view);
      show(view);
      updateMapAddress(view);
      setStatus('');
      playMapMotion(snapshot);
      if (scopeChanged) revealFarmList();
      if (returnFarm) restoreFarmLink(returnFarm);
    } catch (error) {
      if (ticket !== requestNumber) return;
      if (state) renderControls(state);
      else show(initial);
      setStatus('该地区的地图未能加载，请重新选择。');
      console.error(error);
    } finally {
      clearTimeout(delay);
      if (ticket === requestNumber) {
        loading = false;
        stage.removeAttribute('aria-busy');
      }
    }
  }

  function clickRegion(params) {
    if (loading || params.componentType !== 'geo') return;
    const code = params.name;
    if (!state.province && provinces.some(item => codeOf(item) === code)) navigate(code);
    else if (state.districts.some(item => codeOf(item) === code)) navigate(state.province, state.city, code);
    else if (state.cities.some(item => codeOf(item) === code)) navigate(state.province, code);
  }

  const provinces = childRegions(china, 'province');
  const land = landAndSea();
  const initial = nationalView();
  fillSelect(provinceSelect, provinces, '', '全国');
  renderControls(initial);

  chart = echarts.init(mapElement);
  chart.on('click', clickRegion);
  provinceSelect.addEventListener('change', () => navigate(provinceSelect.value));
  citySelect.addEventListener('change', () => navigate(state.province, citySelect.value));
  districtSelect.addEventListener('change', () => navigate(state.province, state.city, districtSelect.value));
  back.addEventListener('click', () => navigate(...state.trail.at(-2).route));
  for (const button of examples) {
    button.addEventListener('click', () => navigate(button.dataset.province, button.dataset.city));
  }
  window.addEventListener('pageshow', refreshFarmGrades);
  window.addEventListener('storage', event => {
    if (operations.affectsOperations(event)) refreshFarmGrades();
  });

  let resizeFrame;
  new ResizeObserver(() => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      const { clientWidth, clientHeight } = mapElement;
      if (!state || !clientWidth || !clientHeight) return;
      if (chart.getWidth() === clientWidth && chart.getHeight() === clientHeight) return;
      stopMapMotion();
      chart.resize();
      paint(state);
    });
  }).observe(mapElement);

  const route = new URLSearchParams(location.hash.slice(1));
  const startProvince = route.get('province');
  if (startProvince) {
    navigate(startProvince, route.get('city') || '', route.get('district') || '', route.get('farm') || '');
  } else {
    show(initial);
  }
})();
