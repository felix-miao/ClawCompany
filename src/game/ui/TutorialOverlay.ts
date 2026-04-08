import * as Phaser from 'phaser';

export interface TutorialConfig {
  title?: string;
  steps: TutorialStep[];
  onComplete?: () => void;
  skipButton?: boolean;
}

export interface TutorialStep {
  target?: string;
  title: string;
  description: string;
  position?: { x: number; y: number };
  width?: number;
  height?: number;
  highlight?: boolean;
}

const DEFAULT_CONFIG: Required<TutorialConfig> = {
  title: '欢迎来到虚拟办公室',
  skipButton: true,
  steps: [],
  onComplete: () => {},
};

const HIGHLIGHT_BLINK_SPEED = 500;
const ARROW_SIZE = 12;
const PADDING = 20;

export class TutorialOverlay {
  private scene: Phaser.Scene;
  private config: Required<TutorialConfig>;
  private container: Phaser.GameObjects.Container;
  private background: Phaser.GameObjects.Graphics;
  private panel: Phaser.GameObjects.Container;
  private panelGraphics: Phaser.GameObjects.Graphics;
  private titleText: Phaser.GameObjects.Text;
  private descriptionText: Phaser.GameObjects.Text;
  private stepIndicator: Phaser.GameObjects.Text;
  private skipButton: Phaser.GameObjects.Text;
  private nextButton: Phaser.GameObjects.Text;
  private prevButton: Phaser.GameObjects.Text;
  private highlightGraphics: Phaser.GameObjects.Graphics;
  private currentStep: number = 0;
  private highlightTween: Phaser.Tweens.Tween | null = null;
  private autoAdvanceTimer: Phaser.Time.TimerEvent | null = null;

  constructor(scene: Phaser.Scene, config: TutorialConfig) {
    this.scene = scene;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.currentStep = 0;

    this.container = scene.add.container(0, 0);
    this.container.setDepth(1000);
    this.container.setVisible(false);

    this.background = scene.add.graphics();
    this.highlightGraphics = scene.add.graphics();
    this.highlightGraphics.setDepth(1001);

    this.panel = scene.add.container(0, 0);
    this.panelGraphics = scene.add.graphics();
    this.titleText = scene.add.text(0, 0, '', {
      fontSize: '20px',
      color: '#ffffff',
      fontFamily: 'Arial',
      align: 'center',
      wordWrap: { width: 300 },
    });
    this.descriptionText = scene.add.text(0, 0, '', {
      fontSize: '16px',
      color: '#e0e0e0',
      fontFamily: 'Arial',
      align: 'center',
      wordWrap: { width: 350 },
    });
    this.stepIndicator = scene.add.text(0, 0, '', {
      fontSize: '14px',
      color: '#b0b0b0',
      fontFamily: 'Arial',
    });
    this.skipButton = scene.add.text(0, 0, '跳过引导', {
      fontSize: '14px',
      color: '#ff6b6b',
      fontFamily: 'Arial',
    });
    this.nextButton = scene.add.text(0, 0, '下一步 →', {
      fontSize: '14px',
      color: '#4ecdc4',
      fontFamily: 'Arial',
    });
    this.prevButton = scene.add.text(0, 0, '← 上一步', {
      fontSize: '14px',
      color: '#b0b0b0',
      fontFamily: 'Arial',
    });

    this.setupPanel();
    this.setupSkipButton();
    this.setupNavigationButtons();
    this.updateContent();

    this.container.add([this.background, this.panel]);
  }

  private setupPanel(): void {
    const panelWidth = 400;
    const panelHeight = 200;
    const cornerRadius = 12;

    // 面板背景
    this.panelGraphics.fillStyle(0x1a1a2e, 0.95);
    this.panelGraphics.lineStyle(2, 0x4a5568, 1);
    this.panelGraphics.fillRoundedRect(
      -panelWidth / 2,
      -panelHeight / 2,
      panelWidth,
      panelHeight,
      cornerRadius
    );
    this.panelGraphics.strokeRoundedRect(
      -panelWidth / 2,
      -panelHeight / 2,
      panelWidth,
      panelHeight,
      cornerRadius
    );

    // 装饰边框
    this.panelGraphics.lineStyle(1, 0xff5833, 0.6);
    this.panelGraphics.strokeRoundedRect(
      -panelWidth / 2 + 5,
      -panelHeight / 2 + 5,
      panelWidth - 10,
      panelHeight - 10,
      cornerRadius - 5
    );

    this.panel.add([this.panelGraphics, this.titleText, this.descriptionText, this.stepIndicator]);
  }

  private setupSkipButton(): void {
    if (this.config.skipButton) {
      this.skipButton.setInteractive();
      this.skipButton.on('pointerdown', () => {
        this.complete();
      });
      this.skipButton.on('pointerover', () => {
        this.skipButton.setColor('#ff8888');
      });
      this.skipButton.on('pointerout', () => {
        this.skipButton.setColor('#ff6b6b');
      });

      this.panel.add(this.skipButton);
    }
  }

  private setupNavigationButtons(): void {
    this.nextButton.setInteractive();
    this.nextButton.on('pointerdown', () => {
      this.nextStep();
    });
    this.nextButton.on('pointerover', () => {
      this.nextButton.setColor('#7eddd6');
    });
    this.nextButton.on('pointerout', () => {
      this.nextButton.setColor('#4ecdc4');
    });

    this.prevButton.setInteractive();
    this.prevButton.on('pointerdown', () => {
      this.previousStep();
    });
    this.prevButton.on('pointerover', () => {
      this.prevButton.setColor('#d0d0d0');
    });
    this.prevButton.on('pointerout', () => {
      this.prevButton.setColor('#b0b0b0');
    });

    this.panel.add([this.nextButton, this.prevButton]);
  }

  show(): void {
    this.container.setVisible(true);
    this.currentStep = 0;
    this.updateContent();
    this.setupHighlight();
  }

  hide(): void {
    this.container.setVisible(false);
    if (this.highlightTween) {
      this.highlightTween.destroy();
      this.highlightTween = null;
    }
    if (this.autoAdvanceTimer) {
      this.autoAdvanceTimer.remove();
      this.autoAdvanceTimer = null;
    }
  }

  private updateContent(): void {
    if (this.currentStep >= this.config.steps.length) {
      this.complete();
      return;
    }

    const step = this.config.steps[this.currentStep];
    
    // 更新面板位置
    const position = step.position || { x: this.scene.cameras.main.width / 2, y: 150 };
    this.panel.setPosition(position.x, position.y);

    // 更新标题
    this.titleText.setText(step.title);
    this.titleText.setOrigin(0.5);
    this.titleText.setY(-60);

    // 更新描述
    this.descriptionText.setText(step.description);
    this.descriptionText.setOrigin(0.5);
    this.descriptionText.setY(0);

    // 更新步骤指示器
    this.stepIndicator.setText(`${this.currentStep + 1} / ${this.config.steps.length}`);
    this.stepIndicator.setOrigin(0.5);
    this.stepIndicator.setY(70);

    // 更新跳过按钮位置
    if (this.config.skipButton) {
      this.skipButton.setPosition(150, 80);
    }

    // 更新导航按钮位置
    const isLastStep = this.currentStep >= this.config.steps.length - 1;
    const isFirstStep = this.currentStep === 0;

    this.nextButton.setText(isLastStep ? '完成 ✓' : '下一步 →');
    this.nextButton.setPosition(80, 80);
    this.nextButton.setAlpha(1);

    this.prevButton.setPosition(-150, 80);
    this.prevButton.setAlpha(isFirstStep ? 0.3 : 1);

    // 设置高亮
    this.setupHighlight();

    // 自动推进定时器（15秒，给用户足够时间阅读）
    if (this.autoAdvanceTimer) {
      this.autoAdvanceTimer.remove();
    }
    this.autoAdvanceTimer = this.scene.time.addEvent({
      delay: 15000,
      callback: () => {
        this.nextStep();
      },
      loop: false,
    });
  }

  private setupHighlight(): void {
    const step = this.config.steps[this.currentStep];
    if (!step) return;

    this.highlightGraphics.clear();

    if (step.width && step.height) {
      // 高亮指定区域
      const x = (step.position?.x || this.scene.cameras.main.width / 2) - step.width / 2;
      const y = (step.position?.y || this.scene.cameras.main.height / 2) - step.height / 2;
      this.drawHighlight(x, y, step.width, step.height);
    }

    // 添加闪烁效果
    if (step.highlight) {
      this.startHighlightAnimation();
    }
  }

  private drawHighlight(x: number, y: number, width: number, height: number): void {
    // 绘制高亮边框
    this.highlightGraphics.lineStyle(3, 0xff5833, 1);
    this.highlightGraphics.strokeRect(x, y, width, height);
    
    // 绘制装饰边框
    this.highlightGraphics.lineStyle(2, 0xffffff, 0.6);
    this.highlightGraphics.strokeRect(x - 2, y - 2, width + 4, height + 4);
    
    // 绘制箭头
    this.drawArrow(x + width / 2, y - 20, x + width / 2, y);
  }

  private drawArrow(fromX: number, fromY: number, toX: number, toY: number): void {
    const angle = Math.atan2(toY - fromY, toX - fromX);
    
    this.highlightGraphics.lineStyle(2, 0xff5833, 1);
    this.highlightGraphics.beginPath();
    this.highlightGraphics.moveTo(fromX, fromY);
    this.highlightGraphics.lineTo(toX, toY);
    this.highlightGraphics.stroke();
    
    // 箭头头部
    this.highlightGraphics.beginPath();
    this.highlightGraphics.moveTo(toX, toY);
    this.highlightGraphics.lineTo(
      toX - ARROW_SIZE * Math.cos(angle - Math.PI / 6),
      toY - ARROW_SIZE * Math.sin(angle - Math.PI / 6)
    );
    this.highlightGraphics.moveTo(toX, toY);
    this.highlightGraphics.lineTo(
      toX - ARROW_SIZE * Math.cos(angle + Math.PI / 6),
      toY - ARROW_SIZE * Math.sin(angle + Math.PI / 6)
    );
    this.highlightGraphics.stroke();
  }

  private startHighlightAnimation(): void {
    if (this.highlightTween) {
      this.highlightTween.destroy();
    }

    this.highlightTween = this.scene.tweens.add({
      targets: this.highlightGraphics,
      alpha: 0.3,
      duration: HIGHLIGHT_BLINK_SPEED,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  nextStep(): void {
    this.currentStep++;
    this.updateContent();
  }

  previousStep(): void {
    if (this.currentStep > 0) {
      this.currentStep--;
      this.updateContent();
    }
  }

  complete(): void {
    this.hide();
    if (this.config.onComplete) {
      this.config.onComplete();
    }
  }

  destroy(): void {
    this.hide();
    this.container.destroy();
    this.highlightGraphics.destroy();
    this.nextButton.destroy();
    this.prevButton.destroy();
    if (this.highlightTween) {
      this.highlightTween.destroy();
    }
  }
}