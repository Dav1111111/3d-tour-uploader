// 3D Panoramic Viewer Application
class PanoramicViewer {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.currentPanorama = null;
        this.panoramas = [];
        this.isAutoRotating = false;
        this.isDragging = false;
        this.dragCounter = 0; // Fix for drag-and-drop issue
        
        // Configuration from provided data
        this.config = {
            supportedFormats: ["image/jpeg", "image/png", "image/webp"],
            maxFileSize: 52428800, // 50MB
            aspectRatioTolerance: 0.1,
            targetAspectRatio: 2.0,
            autoRotateSpeed: 0.5
        };

        this.messages = {
            welcome: "Добро пожаловать в 3D просмотрщик панорам! Загрузите свои панорамные изображения для создания виртуального тура.",
            dragDrop: "Перетащите панорамные изображения сюда или нажмите для выбора файлов",
            validationError: "Файл должен быть изображением в формате JPEG, PNG или WebP с пропорциями примерно 2:1",
            loadingError: "Ошибка загрузки изображения. Пожалуйста, попробуйте другой файл."
        };

        this.init();
    }

    init() {
        this.setupThreeJS();
        this.setupEventListeners();
        this.loadPreloadedPanoramas();
        this.updateGalleryCounter();
        this.showNotification(this.messages.welcome, 'success');
        
        // Show interaction hint
        setTimeout(() => {
            this.showInteractionHint(true);
        }, 1000);
    }

    setupThreeJS() {
        const container = document.getElementById('viewerContainer');
        
        // Scene
        this.scene = new THREE.Scene();
        
        // Camera
        this.camera = new THREE.PerspectiveCamera(
            75,
            container.clientWidth / container.clientHeight,
            0.1,
            1000
        );
        
        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(this.renderer.domElement);
        
        // --- Обработка потери WebGL-контекста (актуально для Telegram WebView) ---
        const canvas = this.renderer.domElement;
        canvas.addEventListener('webglcontextlost', (e) => {
            e.preventDefault(); // предотвращаем падение контекста
        });
        canvas.addEventListener('webglcontextrestored', () => {
            if (this.panoramas.length > 0) {
                this.loadPanorama(this.panoramas[0]); // перезагружаем текущую панораму
            }
        });
        // -------------------------------------------------------------------------
        
        // Setup camera controls
        this.setupControls();
        
        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize());
        
        // Start render loop
        this.animate();
    }

    setupControls() {
        const canvas = this.renderer.domElement;
        let isMouseDown = false;
        let mouseX = 0, mouseY = 0;
        let phi = 0, theta = 0;
        
        // Mouse controls
        canvas.addEventListener('mousedown', (e) => {
            this.showInteractionHint(false);
            isMouseDown = true;
            mouseX = e.clientX;
            mouseY = e.clientY;
            this.isDragging = true;
        });

        canvas.addEventListener('mousemove', (e) => {
            if (!isMouseDown) return;
            
            const deltaX = e.clientX - mouseX;
            const deltaY = e.clientY - mouseY;
            
            phi += deltaX * 0.01;
            theta += deltaY * 0.01;
            theta = Math.max(-Math.PI/2, Math.min(Math.PI/2, theta));
            
            this.updateCameraRotation(phi, theta);
            
            mouseX = e.clientX;
            mouseY = e.clientY;
        });

        canvas.addEventListener('mouseup', () => {
            isMouseDown = false;
            setTimeout(() => { this.isDragging = false; }, 100);
        });

        // Touch controls
        let lastTouchX = 0, lastTouchY = 0;
        
        canvas.addEventListener('touchstart', (e) => {
            this.showInteractionHint(false);
            e.preventDefault();
            const touch = e.touches[0];
            lastTouchX = touch.clientX;
            lastTouchY = touch.clientY;
            this.isDragging = true;
        });

        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const deltaX = touch.clientX - lastTouchX;
            const deltaY = touch.clientY - lastTouchY;
            
            phi += deltaX * 0.01;
            theta += deltaY * 0.01;
            theta = Math.max(-Math.PI/2, Math.min(Math.PI/2, theta));
            
            this.updateCameraRotation(phi, theta);
            
            lastTouchX = touch.clientX;
            lastTouchY = touch.clientY;
        });

        canvas.addEventListener('touchend', () => {
            setTimeout(() => { this.isDragging = false; }, 100);
        });

        // Zoom controls
        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const fov = this.camera.fov + e.deltaY * 0.05;
            this.camera.fov = Math.max(10, Math.min(100, fov));
            this.camera.updateProjectionMatrix();
        });

        // Keyboard controls
        document.addEventListener('keydown', (e) => {
            const step = 0.1;
            switch(e.code) {
                case 'ArrowLeft':
                    phi -= step;
                    this.updateCameraRotation(phi, theta);
                    break;
                case 'ArrowRight':
                    phi += step;
                    this.updateCameraRotation(phi, theta);
                    break;
                case 'ArrowUp':
                    theta = Math.max(-Math.PI/2, theta - step);
                    this.updateCameraRotation(phi, theta);
                    break;
                case 'ArrowDown':
                    theta = Math.min(Math.PI/2, theta + step);
                    this.updateCameraRotation(phi, theta);
                    break;
            }
        });
    }

    updateCameraRotation(phi, theta) {
        this.camera.position.x = Math.cos(phi) * Math.cos(theta);
        this.camera.position.y = Math.sin(theta);
        this.camera.position.z = Math.sin(phi) * Math.cos(theta);
        this.camera.lookAt(0, 0, 0);
    }

    setupEventListeners() {
        // Upload button
        document.getElementById('uploadBtn').addEventListener('click', () => {
            document.getElementById('fileInput').click();
        });

        // File input
        document.getElementById('fileInput').addEventListener('change', (e) => {
            this.handleFiles(e.target.files);
        });

        // Auto-rotate button
        document.getElementById('autoRotateBtn').addEventListener('click', () => {
            this.toggleAutoRotate();
        });

        // Reset camera button
        document.getElementById('resetCameraBtn').addEventListener('click', () => {
            this.resetCamera();
        });

        // Drag and drop - Fixed implementation
        const dropZone = document.getElementById('dropZone');
        const viewer = document.querySelector('.viewer');

        // Prevent default drag behaviors
        const preventDefaults = (e) => {
            e.preventDefault();
            e.stopPropagation();
        };

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            document.body.addEventListener(eventName, preventDefaults, false);
            viewer.addEventListener(eventName, preventDefaults, false);
        });

        // Handle drag enter/leave with counter to avoid flickering
        viewer.addEventListener('dragenter', (e) => {
            this.dragCounter++;
            dropZone.classList.add('active');
        });

        viewer.addEventListener('dragover', (e) => {
            dropZone.classList.add('active');
        });

        viewer.addEventListener('dragleave', (e) => {
            this.dragCounter--;
            if (this.dragCounter === 0) {
                dropZone.classList.remove('active');
            }
        });

        viewer.addEventListener('drop', (e) => {
            this.dragCounter = 0;
            dropZone.classList.remove('active');
            const files = e.dataTransfer.files;
            this.handleFiles(files);
        });
    }

    async handleFiles(files) {
        const validFiles = Array.from(files).filter(file => this.validateFile(file));
        
        if (validFiles.length === 0) {
            this.showNotification(this.messages.validationError, 'error');
            return;
        }

        for (const file of validFiles) {
            await this.loadPanoramaFromFile(file);
        }
    }

    validateFile(file) {
        // Check file type
        if (!this.config.supportedFormats.includes(file.type)) {
            return false;
        }

        // Check file size
        if (file.size > this.config.maxFileSize) {
            this.showNotification(`Файл слишком большой. Максимальный размер: ${this.config.maxFileSize / 1024 / 1024}MB`, 'error');
            return false;
        }

        return true;
    }

    async loadPanoramaFromFile(file) {
        return new Promise((resolve, reject) => {
            this.showLoading(true);
            
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    // Validate aspect ratio
                    const aspectRatio = img.width / img.height;
                    if (Math.abs(aspectRatio - this.config.targetAspectRatio) > this.config.aspectRatioTolerance) {
                        this.showNotification('Изображение должно иметь пропорции примерно 2:1 для панорамы', 'warning');
                    }

                    const panorama = {
                        id: Date.now() + Math.random(),
                        name: file.name,
                        url: e.target.result,
                        type: 'user',
                        size: file.size,
                        dimensions: `${img.width} × ${img.height}`
                    };

                    this.panoramas.push(panorama);
                    this.addToGallery(panorama);
                    this.loadPanorama(panorama);
                    this.updateGalleryCounter();
                    this.showLoading(false);
                    this.showNotification(`Панорама "${file.name}" загружена успешно`, 'success');
                    resolve(panorama);
                };
                
                img.onerror = () => {
                    this.showLoading(false);
                    this.showNotification(this.messages.loadingError, 'error');
                    reject(new Error('Failed to load image'));
                };
                
                img.src = e.target.result;
            };
            
            reader.onerror = () => {
                this.showLoading(false);
                this.showNotification(this.messages.loadingError, 'error');
                reject(new Error('Failed to read file'));
            };
            
            reader.readAsDataURL(file);
        });
    }

    loadPreloadedPanoramas() {
        // Предзагруженные панорамы. Добавьте свои файлы JPG/PNG в папку 'panoramas' и укажите имена ниже.
        const preloaded = [
            { id: 'p1', name: 'Панорама 1', url: 'panoramas/p1.jpg', type: 'default', dimensions: '' },
            { id: 'p2', name: 'Панорама 2', url: 'panoramas/p2.jpg', type: 'default', dimensions: '' },
            { id: 'p3', name: 'Панорама 3', url: 'panoramas/p3.jpg', type: 'default', dimensions: '' },
            { id: 'p4', name: 'Панорама 4', url: 'panoramas/p4.jpg', type: 'default', dimensions: '' },
            { id: 'p5', name: 'Панорама 5', url: 'panoramas/p5.jpg', type: 'default', dimensions: '' },
            { id: 'p6', name: 'Панорама 6', url: 'panoramas/p6.jpeg', type: 'default', dimensions: '' }
        ];

        preloaded.forEach(p => {
            this.panoramas.push(p);
            this.addToGallery(p);
        });

        if (preloaded.length > 0) {
            this.loadPanorama(preloaded[0]);
        }

        this.updateGalleryCounter();
    }

    loadPanorama(panorama) {
        // Clear existing panorama
        if (this.currentPanorama) {
            this.scene.remove(this.currentPanorama);
        }

        const loader = new THREE.TextureLoader();
        loader.load(panorama.url, (texture) => {
            // Create sphere geometry
            const geometry = new THREE.SphereGeometry(500, 60, 40);
            geometry.scale(-1, 1, 1); // Invert geometry to look inward

            const material = new THREE.MeshBasicMaterial({ map: texture });
            const sphere = new THREE.Mesh(geometry, material);
            
            this.scene.add(sphere);
            this.currentPanorama = sphere;
            
            // Update active gallery item
            this.updateActiveGalleryItem(panorama.id);
            
            // Reset camera
            this.resetCamera();
        });
    }

    addToGallery(panorama) {
        const gallery = document.getElementById('gallery');
        
        const item = document.createElement('div');
        item.className = 'gallery-item';
        item.style.position = 'relative';
        item.dataset.id = panorama.id;
        
        item.innerHTML = `
            <div class="gallery-item__image">
                <img src="${panorama.url}" alt="${panorama.name}" loading="lazy">
            </div>
            <div class="gallery-item__info">
                <div class="gallery-item__name">${panorama.name}</div>
                <div class="gallery-item__meta">
                    <span>${panorama.dimensions || 'N/A'}</span>
                    <span>${panorama.type === 'default' ? 'Демо' : 'Загружено'}</span>
                </div>
            </div>
            ${panorama.type !== 'default' ? `
                <button class="gallery-item__delete" title="Удалить">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            ` : ''}
        `;
        
        item.addEventListener('click', (e) => {
            if (!e.target.closest('.gallery-item__delete')) {
                this.loadPanorama(panorama);
            }
        });
        
        if (panorama.type !== 'default') {
            const deleteBtn = item.querySelector('.gallery-item__delete');
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deletePanorama(panorama.id);
            });
        }
        
        gallery.appendChild(item);
    }

    deletePanorama(id) {
        const index = this.panoramas.findIndex(p => p.id === id);
        if (index > -1) {
            this.panoramas.splice(index, 1);
            
            const galleryItem = document.querySelector(`[data-id="${id}"]`);
            if (galleryItem) {
                galleryItem.remove();
            }
            
            // If deleted panorama was active, load another one
            if (this.currentPanorama && this.getCurrentPanoramaId() === id) {
                if (this.panoramas.length > 0) {
                    this.loadPanorama(this.panoramas[0]);
                }
            }
            
            this.updateGalleryCounter();
            this.showNotification('Панорама удалена', 'info');
        }
    }

    getCurrentPanoramaId() {
        const activeItem = document.querySelector('.gallery-item.active');
        return activeItem ? activeItem.dataset.id : null;
    }

    updateActiveGalleryItem(id) {
        document.querySelectorAll('.gallery-item').forEach(item => {
            item.classList.remove('active');
        });
        
        const activeItem = document.querySelector(`[data-id="${id}"]`);
        if (activeItem) {
            activeItem.classList.add('active');
        }
    }

    updateGalleryCounter() {
        const counter = document.getElementById('galleryCount');
        const count = this.panoramas.length;
        counter.textContent = count === 1 ? '1 изображение' : `${count} изображений`;
    }

    toggleAutoRotate() {
        this.isAutoRotating = !this.isAutoRotating;
        const btn = document.getElementById('autoRotateBtn');
        btn.classList.toggle('active', this.isAutoRotating);
    }

    resetCamera() {
        this.camera.position.set(1, 0, 0);
        this.camera.lookAt(0, 0, 0);
        this.camera.fov = 75;
        this.camera.updateProjectionMatrix();
    }

    showInteractionHint(show) {
        const hint = document.getElementById('interactionHint');
        if (show) {
            hint.classList.add('visible');
            // Auto-hide after 5 seconds if no interaction
            setTimeout(() => {
                if (hint.classList.contains('visible')) {
                    hint.classList.remove('visible');
                }
            }, 5000);
        } else {
            hint.classList.remove('visible');
        }
    }

    showLoading(show) {
        const indicator = document.getElementById('loadingIndicator');
        indicator.classList.toggle('active', show);
    }

    showNotification(message, type = 'info') {
        const notifications = document.getElementById('notifications');
        
        const notification = document.createElement('div');
        notification.className = `notification notification--${type}`;
        
        const icons = {
            success: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22,4 12,14.01 9,11.01"></polyline></svg>',
            error: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>',
            warning: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
            info: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>'
        };
        
        notification.innerHTML = `
            <div class="notification__content">
                <div class="notification__icon">${icons[type]}</div>
                <div class="notification__text">${message}</div>
                <button class="notification__close">×</button>
            </div>
        `;
        
        const closeBtn = notification.querySelector('.notification__close');
        closeBtn.addEventListener('click', () => {
            notification.remove();
        });
        
        notifications.appendChild(notification);
        
        // Show notification
        setTimeout(() => notification.classList.add('show'), 100);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }

    onWindowResize() {
        const container = document.getElementById('viewerContainer');
        this.camera.aspect = container.clientWidth / container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(container.clientWidth, container.clientHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        // Auto rotation
        if (this.isAutoRotating && !this.isDragging) {
            if (this.currentPanorama) {
                this.currentPanorama.rotation.y += this.config.autoRotateSpeed * 0.01;
            }
        }
        
        this.renderer.render(this.scene, this.camera);
    }
}

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new PanoramicViewer();
});