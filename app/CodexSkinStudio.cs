using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Markup;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Xml;
using Microsoft.Win32;

[assembly: AssemblyTitle("Codex Skin Studio")]
[assembly: AssemblyDescription("Local-first Codex theme and pet studio")]
[assembly: AssemblyCompany("Codex Skin Studio contributors")]
[assembly: AssemblyProduct("Codex Skin Studio")]
[assembly: AssemblyVersion("0.7.3.0")]
[assembly: AssemblyFileVersion("0.7.3.0")]

namespace CodexSkinStudio
{
    internal static class Program
    {
        [STAThread]
        private static void Main()
        {
            bool created;
            using (var mutex = new Mutex(true, "CodexSkinStudio.Portable.0.7", out created))
            {
                if (!created)
                {
                    MessageBox.Show("Codex Skin Studio 已经在运行。", "Codex Skin Studio", MessageBoxButton.OK, MessageBoxImage.Information);
                    return;
                }

                try
                {
                    RuntimeFiles runtime = RuntimeBootstrap.Ensure();
                    var application = new Application();
                    application.ShutdownMode = ShutdownMode.OnMainWindowClose;
                    var controller = new StudioController(runtime);
                    application.Run(controller.Window);
                }
                catch (Exception error)
                {
                    MessageBox.Show("应用启动失败：\n\n" + error.Message, "Codex Skin Studio", MessageBoxButton.OK, MessageBoxImage.Error);
                }
            }
        }
    }

    internal sealed class RuntimeFiles
    {
        public string Root { get; set; }
        public string Node { get; set; }
        public string Cli { get; set; }
    }

    internal static class RuntimeBootstrap
    {
        private const string Version = "0.7.3";

        public static RuntimeFiles Ensure()
        {
            string root = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "CodexSkinStudio", "portable-runtime", Version);
            string marker = Path.Combine(root, ".ready");
            string node = Path.Combine(root, "node.exe");
            string cli = Path.Combine(root, "runtime", "bin", "codex-skin.mjs");
            string runtimeHash = ResourceHash("CodexSkinStudio.Runtime.zip");
            if (!File.Exists(marker) || File.ReadAllText(marker).Trim() != runtimeHash || !File.Exists(node) || !File.Exists(cli))
            {
                string staging = root + ".stage." + Process.GetCurrentProcess().Id;
                if (Directory.Exists(staging)) Directory.Delete(staging, true);
                Directory.CreateDirectory(staging);
                ExtractResource("CodexSkinStudio.Node.exe", Path.Combine(staging, "node.exe"));
                string archive = Path.Combine(staging, "runtime.zip");
                ExtractResource("CodexSkinStudio.Runtime.zip", archive);
                ZipFile.ExtractToDirectory(archive, Path.Combine(staging, "runtime"));
                File.Delete(archive);
                File.WriteAllText(Path.Combine(staging, ".ready"), runtimeHash, new UTF8Encoding(false));
                if (Directory.Exists(root)) Directory.Delete(root, true);
                Directory.CreateDirectory(Path.GetDirectoryName(root));
                Directory.Move(staging, root);
            }
            return new RuntimeFiles { Root = root, Node = node, Cli = cli };
        }

        private static string ResourceHash(string name)
        {
            Stream source = Assembly.GetExecutingAssembly().GetManifestResourceStream(name);
            if (source == null) throw new InvalidOperationException("便携运行时资源缺失：" + name);
            using (source)
            using (SHA256 digest = SHA256.Create())
            {
                return BitConverter.ToString(digest.ComputeHash(source)).Replace("-", "").ToLowerInvariant();
            }
        }

        private static void ExtractResource(string name, string destination)
        {
            Stream source = Assembly.GetExecutingAssembly().GetManifestResourceStream(name);
            if (source == null) throw new InvalidOperationException("便携运行时资源缺失：" + name);
            using (source)
            using (var target = new FileStream(destination, FileMode.Create, FileAccess.Write, FileShare.None))
            {
                source.CopyTo(target);
            }
        }
    }

    internal sealed class ReferenceItem
    {
        public string Path { get; set; }
        public string Name { get; set; }
        public BitmapSource Thumbnail { get; set; }
    }

    internal sealed class ThemeLibraryItem
    {
        public string Path { get; set; }
        public string BundleId { get; set; }
        public string Name { get; set; }
        public string Summary { get; set; }
        public string CreatedLabel { get; set; }
        public string StatusLabel { get; set; }
        public bool IsApplied { get; set; }
        public DateTime CreatedAt { get; set; }
        public BitmapSource Thumbnail { get; set; }
    }

    internal sealed class CliResult
    {
        public int ExitCode { get; set; }
        public string StandardOutput { get; set; }
        public string StandardError { get; set; }
    }

    internal sealed class StudioController
    {
        private readonly RuntimeFiles runtime;
        private readonly ObservableCollection<ReferenceItem> references = new ObservableCollection<ReferenceItem>();
        private readonly ObservableCollection<ThemeLibraryItem> themeLibrary = new ObservableCollection<ThemeLibraryItem>();
        private readonly JavaScriptSerializer json = new JavaScriptSerializer();
        private Process activeProcess;
        private string currentBundle;
        private bool busy;
        private bool cancelRequested;

        public Window Window { get; private set; }

        private ListBox referenceList;
        private ListBox themeLibraryList;
        private TextBox briefBox;
        private ComboBox presetBox;
        private Image previewImage;
        private Image petImage;
        private Border previewTint;
        private Border previewPage;
        private Border previewHero;
        private Border mockHeroPanel;
        private Border mockSidebar;
        private Border mockSurface;
        private Border mockComposer;
        private Border petFrame;
        private TextBlock mockHeroTitle;
        private TextBlock mockHeroSummary;
        private TextBlock mockComposerPlaceholder;
        private TextBlock mockSignature;
        private TextBlock previewTitle;
        private TextBlock previewSubtitle;
        private Border canvasHint;
        private TextBlock statusText;
        private TextBlock runtimeText;
        private TextBlock bundleText;
        private TextBlock libraryCountText;
        private TextBlock libraryEmptyText;
        private TextBlock stepOne;
        private TextBlock stepTwo;
        private TextBlock stepThree;
        private TextBlock stepFour;
        private Button generateButton;
        private Button previewButton;
        private Button applyButton;
        private Button restoreButton;
        private Button cancelButton;
        private Button flowModeButton;
        private Button libraryModeButton;
        private Button libraryApplyButton;
        private Button refreshLibraryButton;
        private Button deleteLibraryButton;
        private Grid flowPanel;
        private Grid libraryPanel;
        private ProgressBar progress;
        private readonly List<Border> swatches = new List<Border>();
        private readonly List<Border> previewCards = new List<Border>();
        private readonly List<Border> previewAccents = new List<Border>();
        private readonly List<TextBlock> previewCardTitles = new List<TextBlock>();
        private readonly List<TextBlock> previewCardSubtitles = new List<TextBlock>();
        private readonly List<Image> previewIconImages = new List<Image>();

        public StudioController(RuntimeFiles runtimeFiles)
        {
            runtime = runtimeFiles;
            Window = LoadShell();
            BindControls();
            BindEvents();
            referenceList.ItemsSource = references;
            themeLibraryList.ItemsSource = themeLibrary;
            Window.Loaded += async delegate { RefreshThemeLibrary(true); await CheckRuntimeAsync(); };
        }

        private Window LoadShell()
        {
            const string xaml = @"
<Window xmlns='http://schemas.microsoft.com/winfx/2006/xaml/presentation'
        xmlns:x='http://schemas.microsoft.com/winfx/2006/xaml'
        Title='Codex Skin Studio' Width='1460' Height='860' MinWidth='1180' MinHeight='720'
        WindowStartupLocation='CenterScreen' Background='#0E0F11' Foreground='#F5F2EC'
        FontFamily='Microsoft YaHei UI' AllowDrop='True'>
  <Window.Resources>
    <SolidColorBrush x:Key='Ink' Color='#0E0F11'/>
    <SolidColorBrush x:Key='Panel' Color='#15171A'/>
    <SolidColorBrush x:Key='Raised' Color='#1D2024'/>
    <SolidColorBrush x:Key='Border' Color='#30343A'/>
    <SolidColorBrush x:Key='Text' Color='#F5F2EC'/>
    <SolidColorBrush x:Key='Muted' Color='#92979F'/>
    <SolidColorBrush x:Key='Accent' Color='#F6A04D'/>
    <SolidColorBrush x:Key='AccentHover' Color='#FFB565'/>
    <SolidColorBrush x:Key='Teal' Color='#77D1BE'/>
    <Style TargetType='TextBlock'>
      <Setter Property='Foreground' Value='{StaticResource Text}'/>
    </Style>
    <Style x:Key='SectionLabel' TargetType='TextBlock'>
      <Setter Property='FontSize' Value='12'/><Setter Property='FontWeight' Value='SemiBold'/>
      <Setter Property='Foreground' Value='{StaticResource Muted}'/><Setter Property='Margin' Value='0,0,0,9'/>
    </Style>
    <Style x:Key='StudioButton' TargetType='Button'>
      <Setter Property='Foreground' Value='{StaticResource Text}'/><Setter Property='Background' Value='{StaticResource Raised}'/>
      <Setter Property='BorderBrush' Value='{StaticResource Border}'/><Setter Property='BorderThickness' Value='1'/>
      <Setter Property='Padding' Value='15,10'/><Setter Property='FontSize' Value='13'/><Setter Property='FontWeight' Value='SemiBold'/>
      <Setter Property='Cursor' Value='Hand'/><Setter Property='HorizontalContentAlignment' Value='Center'/>
      <Setter Property='Template'>
        <Setter.Value><ControlTemplate TargetType='Button'>
          <Border x:Name='Chrome' Background='{TemplateBinding Background}' BorderBrush='{TemplateBinding BorderBrush}'
                  BorderThickness='{TemplateBinding BorderThickness}' CornerRadius='9' Padding='{TemplateBinding Padding}'>
            <ContentPresenter HorizontalAlignment='{TemplateBinding HorizontalContentAlignment}' VerticalAlignment='Center'/>
          </Border>
          <ControlTemplate.Triggers>
            <Trigger Property='IsMouseOver' Value='True'><Setter TargetName='Chrome' Property='Background' Value='#282C31'/></Trigger>
            <Trigger Property='IsKeyboardFocused' Value='True'><Setter TargetName='Chrome' Property='BorderBrush' Value='#E6B986'/></Trigger>
            <Trigger Property='IsEnabled' Value='False'><Setter TargetName='Chrome' Property='Opacity' Value='.42'/></Trigger>
          </ControlTemplate.Triggers>
        </ControlTemplate></Setter.Value>
      </Setter>
    </Style>
    <Style x:Key='PrimaryButton' TargetType='Button' BasedOn='{StaticResource StudioButton}'>
      <Setter Property='Background' Value='{StaticResource Accent}'/><Setter Property='Foreground' Value='#19130D'/>
      <Setter Property='BorderBrush' Value='{StaticResource Accent}'/><Setter Property='Padding' Value='16,13'/>
      <Setter Property='Template'>
        <Setter.Value><ControlTemplate TargetType='Button'>
          <Border x:Name='Chrome' Background='{TemplateBinding Background}' BorderBrush='{TemplateBinding BorderBrush}'
                  BorderThickness='1' CornerRadius='10' Padding='{TemplateBinding Padding}'>
            <ContentPresenter HorizontalAlignment='Center' VerticalAlignment='Center'/>
          </Border>
          <ControlTemplate.Triggers>
            <Trigger Property='IsMouseOver' Value='True'><Setter TargetName='Chrome' Property='Background' Value='{StaticResource AccentHover}'/></Trigger>
            <Trigger Property='IsKeyboardFocused' Value='True'><Setter TargetName='Chrome' Property='BorderBrush' Value='#F4EEF8'/></Trigger>
            <Trigger Property='IsEnabled' Value='False'><Setter TargetName='Chrome' Property='Opacity' Value='.42'/></Trigger>
          </ControlTemplate.Triggers>
        </ControlTemplate></Setter.Value>
      </Setter>
    </Style>
    <Style TargetType='TextBox'>
      <Setter Property='Foreground' Value='{StaticResource Text}'/><Setter Property='Background' Value='#1A1C20'/>
      <Setter Property='BorderBrush' Value='{StaticResource Border}'/><Setter Property='BorderThickness' Value='1'/>
      <Setter Property='Padding' Value='12'/><Setter Property='CaretBrush' Value='{StaticResource Accent}'/>
    </Style>
    <Style TargetType='ComboBox'>
      <Setter Property='Foreground' Value='#191B1F'/><Setter Property='Background' Value='#F5F2EC'/>
      <Setter Property='BorderBrush' Value='{StaticResource Border}'/><Setter Property='BorderThickness' Value='1'/>
      <Setter Property='Padding' Value='10,7'/><Setter Property='FontSize' Value='12'/>
    </Style>
    <Style TargetType='ComboBoxItem'>
      <Setter Property='Foreground' Value='#191B1F'/><Setter Property='Padding' Value='10,7'/>
    </Style>
  </Window.Resources>
  <Grid>
    <Grid.RowDefinitions><RowDefinition Height='62'/><RowDefinition Height='*'/><RowDefinition Height='34'/></Grid.RowDefinitions>
    <Border Grid.Row='0' Background='#111316' BorderBrush='{StaticResource Border}' BorderThickness='0,0,0,1'>
      <Grid Margin='20,0'><Grid.ColumnDefinitions><ColumnDefinition Width='*'/><ColumnDefinition Width='Auto'/></Grid.ColumnDefinitions>
        <StackPanel Orientation='Horizontal' VerticalAlignment='Center'>
          <Border Width='34' Height='34' CornerRadius='5' BorderBrush='{StaticResource Accent}' BorderThickness='1' Background='#191B1F' Margin='0,0,12,0'>
            <TextBlock Text='CS' Foreground='{StaticResource Accent}' FontFamily='Consolas' FontWeight='Bold' FontSize='12' HorizontalAlignment='Center' VerticalAlignment='Center'/>
          </Border>
          <StackPanel VerticalAlignment='Center'>
            <TextBlock Text='CODEX SKIN STUDIO' FontFamily='Consolas' FontSize='14' FontWeight='Bold'/>
            <TextBlock Text='主题创作工作室  /  SKIN 01' FontSize='10' Foreground='{StaticResource Muted}' Margin='0,3,0,0'/>
          </StackPanel>
        </StackPanel>
        <Border Grid.Column='1' Background='#202A2A' BorderBrush='#34534F' BorderThickness='1' CornerRadius='13' Padding='11,5' VerticalAlignment='Center'>
          <StackPanel Orientation='Horizontal'><Ellipse Width='7' Height='7' Fill='{StaticResource Teal}' Margin='0,0,7,0'/><TextBlock x:Name='RuntimeText' Text='正在检查本地 Codex' FontSize='11' Foreground='#BFE9E2'/></StackPanel>
        </Border>
      </Grid>
    </Border>

    <Grid Grid.Row='1'>
      <Grid.ColumnDefinitions><ColumnDefinition Width='294'/><ColumnDefinition Width='*'/><ColumnDefinition Width='254'/></Grid.ColumnDefinitions>
      <Border Grid.Column='0' Background='{StaticResource Panel}' BorderBrush='{StaticResource Border}' BorderThickness='0,0,1,0'>
        <ScrollViewer VerticalScrollBarVisibility='Auto'><StackPanel Margin='19,20,19,22'>
          <TextBlock Text='01  REFERENCE / 灵感素材' Style='{StaticResource SectionLabel}' FontFamily='Consolas'/>
          <Border x:Name='DropZone' Height='108' CornerRadius='10' Background='#1A1C20' BorderBrush='#3B4047' BorderThickness='1' Margin='0,0,0,12'>
            <Grid><StackPanel VerticalAlignment='Center' HorizontalAlignment='Center'>
              <TextBlock Text='拖入参考图片' FontSize='14' FontWeight='SemiBold' HorizontalAlignment='Center'/>
              <TextBlock Text='PNG、JPEG 或 WebP，最多 32 张' FontSize='11' Foreground='{StaticResource Muted}' Margin='0,5,0,10' HorizontalAlignment='Center'/>
              <Button x:Name='AddImagesButton' Content='选择图片' Style='{StaticResource StudioButton}' Padding='13,6'/>
            </StackPanel></Grid>
          </Border>
          <Grid Margin='0,0,0,8'><Grid.ColumnDefinitions><ColumnDefinition Width='*'/><ColumnDefinition Width='Auto'/></Grid.ColumnDefinitions>
            <TextBlock Text='已选素材' FontSize='12' Foreground='{StaticResource Muted}' VerticalAlignment='Center'/>
            <Button x:Name='ClearImagesButton' Grid.Column='1' Content='清空' Style='{StaticResource StudioButton}' Padding='9,4' FontSize='11'/>
          </Grid>
          <ListBox x:Name='ReferenceList' Height='142' Background='Transparent' BorderThickness='0' ScrollViewer.HorizontalScrollBarVisibility='Disabled' Margin='0,0,0,20'>
            <ListBox.ItemTemplate><DataTemplate>
              <Border Background='#1A1C20' BorderBrush='#292D32' BorderThickness='1' CornerRadius='7' Padding='7' Margin='0,0,0,6'>
                <Grid><Grid.ColumnDefinitions><ColumnDefinition Width='42'/><ColumnDefinition Width='*'/></Grid.ColumnDefinitions>
                  <Border Width='36' Height='36' CornerRadius='6' ClipToBounds='True'><Image Source='{Binding Thumbnail}' Stretch='UniformToFill'/></Border>
                  <StackPanel Grid.Column='1' Margin='9,0,0,0' VerticalAlignment='Center'>
                    <TextBlock Text='{Binding Name}' FontSize='12' TextTrimming='CharacterEllipsis'/>
                    <TextBlock Text='本地图片' FontSize='10' Foreground='{StaticResource Muted}' Margin='0,2,0,0'/>
                  </StackPanel>
                </Grid>
              </Border>
            </DataTemplate></ListBox.ItemTemplate>
          </ListBox>

          <TextBlock Text='02  DIRECTION / 创作需求' Style='{StaticResource SectionLabel}' FontFamily='Consolas'/>
          <TextBlock Text='风格导演（内置提示词）' FontSize='11' Foreground='{StaticResource Muted}' Margin='0,0,0,7'/>
          <ComboBox x:Name='PresetBox' SelectedIndex='0' Margin='0,0,0,8' AutomationProperties.Name='内置风格导演'>
            <ComboBoxItem Content='自动判断 · 从图片提炼原创方向'/>
            <ComboBoxItem Content='清透收藏 · 纸感与植物留白'/>
            <ComboBoxItem Content='活力宇宙 · 涂鸦与明快撞色'/>
            <ComboBoxItem Content='未来宣言 · 编辑感与高对比'/>
            <ComboBoxItem Content='紫夜星光 · 发光与梦幻符号'/>
            <ComboBoxItem Content='舞台黑金 · 戏剧感与克制奢华'/>
            <ComboBoxItem Content='好运开工 · 红金与东方吉祥纹样'/>
            <ComboBoxItem Content='音乐彩光 · 青粉节奏与星光'/>
          </ComboBox>
          <TextBlock Text='主视觉、版式、侧栏、卡片、输入区和文案会作为同一套系统生成。' FontSize='9.5' Foreground='#7F858D' TextWrapping='Wrap' Margin='2,0,2,9'/>
          <TextBox x:Name='BriefBox' Height='124' AcceptsReturn='True' TextWrapping='Wrap' VerticalScrollBarVisibility='Auto'
                   Text='以参考图片中的主体和核心元素为主题，保留可识别虚构角色的标志特征。先生成适合 Codex 的横版主视觉与统一图标，再设计侧栏、卡片、输入区和主题文案。整体适合长时间使用。'/>
          <Border Background='#15201E' BorderBrush='#2B4842' BorderThickness='1' CornerRadius='8' Padding='11' Margin='0,13,0,0'>
            <TextBlock Text='当前流程只生成皮肤，不会读取、安装或修改 ~/.codex/pets。图片通过你的本地 Codex 登录处理。' FontSize='10.5' Foreground='#A8D3CB' TextWrapping='Wrap' LineHeight='17'/>
          </Border>
        </StackPanel></ScrollViewer>
      </Border>

      <Grid Grid.Column='1' Margin='22,18'>
        <Grid.RowDefinitions><RowDefinition Height='Auto'/><RowDefinition Height='*'/><RowDefinition Height='68'/></Grid.RowDefinitions>
        <Grid Grid.Row='0' Margin='2,0,2,14'><Grid.ColumnDefinitions><ColumnDefinition Width='*'/><ColumnDefinition Width='Auto'/></Grid.ColumnDefinitions>
          <StackPanel><TextBlock Text='COMPOSITION STAGE' FontFamily='Consolas' FontSize='9.5' Foreground='{StaticResource Accent}'/><TextBlock x:Name='PreviewTitle' Text='等待灵感' FontSize='24' FontWeight='SemiBold' Margin='0,4,0,0'/><TextBlock x:Name='PreviewSubtitle' Text='加入图片后，这里会成为你的主题画布。' FontSize='11' Foreground='{StaticResource Muted}' Margin='0,4,0,0'/></StackPanel>
          <Border Grid.Column='1' CornerRadius='13' Background='#24202B' BorderBrush='{StaticResource Border}' BorderThickness='1' Padding='10,5' VerticalAlignment='Center'>
            <TextBlock x:Name='BundleText' Text='尚未生成' FontSize='11' Foreground='{StaticResource Muted}'/>
          </Border>
        </Grid>

        <Border x:Name='PreviewPage' Grid.Row='1' CornerRadius='12' BorderBrush='#3A3F46' BorderThickness='1' Background='#090A0C' Padding='9'>
          <Border.Resources>
            <SolidColorBrush x:Key='PreviewTextBrush' Color='#352A35'/>
            <Style TargetType='TextBlock'><Setter Property='Foreground' Value='{DynamicResource PreviewTextBrush}'/></Style>
          </Border.Resources>
          <Grid x:Name='PreviewWorkspace' ClipToBounds='True'>
            <Grid.RowDefinitions><RowDefinition Height='26'/><RowDefinition Height='*'/></Grid.RowDefinitions>
            <Grid.ColumnDefinitions><ColumnDefinition Width='146'/><ColumnDefinition Width='*'/></Grid.ColumnDefinitions>
            <Border Grid.ColumnSpan='2' Background='#17191D' BorderBrush='#30343A' BorderThickness='0,0,0,1'>
              <Grid Margin='10,0'><Grid.ColumnDefinitions><ColumnDefinition Width='Auto'/><ColumnDefinition Width='*'/><ColumnDefinition Width='Auto'/></Grid.ColumnDefinitions><StackPanel Orientation='Horizontal' VerticalAlignment='Center'><Ellipse Width='6' Height='6' Fill='#EF6A5B' Margin='0,0,5,0'/><Ellipse Width='6' Height='6' Fill='#E5B34B' Margin='0,0,5,0'/><Ellipse Width='6' Height='6' Fill='#63C58B'/></StackPanel><TextBlock Grid.Column='1' Text='CODEX  /  THEME PREVIEW' FontFamily='Consolas' Foreground='#8E949C' FontSize='8' HorizontalAlignment='Center' VerticalAlignment='Center'/><TextBlock Grid.Column='2' Text='16:10' FontFamily='Consolas' Foreground='#6E747C' FontSize='8' VerticalAlignment='Center'/></Grid>
            </Border>
            <Border x:Name='MockSidebar' Grid.Row='1' Background='#F8F2F5' BorderBrush='#E6DCE2' BorderThickness='0,0,1,0' Padding='14,16'>
              <Grid><Grid.RowDefinitions><RowDefinition Height='Auto'/><RowDefinition Height='*'/><RowDefinition Height='Auto'/></Grid.RowDefinitions>
                <StackPanel>
                  <TextBlock Text='Codex +' FontSize='16' FontWeight='Bold'/>
                  <Border Height='1' Background='#DCCFD7' Margin='0,11,0,11'/>
                  <TextBlock Text='✦  新建任务' FontSize='10.5' Margin='0,0,0,9'/>
                  <TextBlock Text='◷  已安排' FontSize='10.5' Margin='0,0,0,9'/>
                  <TextBlock Text='◇  插件' FontSize='10.5' Margin='0,0,0,9'/>
                  <TextBlock Text='⌘  技能' FontSize='10.5'/>
                  <TextBlock Text='项目' FontSize='9' FontWeight='Bold' Opacity='.58' Margin='0,18,0,8'/>
                  <TextBlock Text='♡  灵感收藏' FontSize='9.5' Margin='0,0,0,8'/>
                  <TextBlock Text='☆  主题工作台' FontSize='9.5' Margin='0,0,0,8'/>
                  <TextBlock Text='✦  风格规则' FontSize='9.5'/>
                </StackPanel>
                <Border Grid.Row='2' CornerRadius='8' BorderBrush='#DCCFD7' BorderThickness='1' Padding='9,7'>
                  <TextBlock Text='本地工作区  •  安全' FontSize='8.5' Opacity='.68'/>
                </Border>
              </Grid>
            </Border>
            <Border x:Name='MockSurface' Grid.Row='1' Grid.Column='1' Background='#FFFDFE' Padding='16'>
              <Grid><Grid.RowDefinitions><RowDefinition Height='34'/><RowDefinition Height='*'/><RowDefinition Height='88'/><RowDefinition Height='66'/></Grid.RowDefinitions>
                <Grid><Grid.ColumnDefinitions><ColumnDefinition Width='*'/><ColumnDefinition Width='Auto'/></Grid.ColumnDefinitions>
                  <StackPanel Orientation='Horizontal' VerticalAlignment='Center'><TextBlock Text='✦' FontSize='12' Margin='0,0,7,0'/><TextBlock Text='Codex 主题工作台' FontSize='11.5' FontWeight='SemiBold'/></StackPanel>
                  <StackPanel Grid.Column='1' Orientation='Horizontal' VerticalAlignment='Center'><TextBlock x:Name='MockSignature' Text='STUDIO ✦' FontFamily='Georgia' FontStyle='Italic' FontSize='10' Margin='0,0,12,0'/><TextBlock Text='□   ◇' FontSize='10' Opacity='.6'/></StackPanel>
                </Grid>
                <Border x:Name='PreviewHero' Grid.Row='1' CornerRadius='13' ClipToBounds='True' BorderBrush='#E2D5DD' BorderThickness='1'>
                  <Grid>
                    <Image x:Name='PreviewImage' Stretch='UniformToFill'/>
                    <Border x:Name='PreviewTint' Background='#1AFFFFFF'/>
                    <Border x:Name='MockHeroPanel' Background='#D9FFFFFF' CornerRadius='10' Padding='18,14' HorizontalAlignment='Left' VerticalAlignment='Center' Margin='20' MaxWidth='360'>
                      <StackPanel><TextBlock x:Name='MockHeroKicker' Text='PRIVATE THEME / CODEX APP' FontFamily='Consolas' FontSize='8' FontWeight='Bold' Opacity='.62'/><TextBlock x:Name='MockHeroTitle' Text='把灵感变成工作空间' FontSize='22' FontWeight='SemiBold' Margin='0,6,0,5'/><TextBlock x:Name='MockHeroSummary' Text='清晰、完整、可以直接判断最终效果。' FontSize='10' TextWrapping='Wrap' LineHeight='16' Opacity='.78'/></StackPanel>
                    </Border>
                  </Grid>
                </Border>
                <UniformGrid Grid.Row='2' Columns='4' Margin='0,8,0,8'>
                  <Border x:Name='MockCard1' Background='#FFF8FA' BorderBrush='#E2D5DD' BorderThickness='1' CornerRadius='8' Margin='0,0,5,0' Padding='8'><StackPanel VerticalAlignment='Center'><Border x:Name='MockAccent1' Width='30' Height='30' CornerRadius='15' Background='#F1A3B7' HorizontalAlignment='Center' ClipToBounds='True'><Image x:Name='MockIcon1' Stretch='UniformToFill'/></Border><TextBlock x:Name='MockCardTitle1' Text='探索并理解代码' FontSize='8.5' FontWeight='SemiBold' HorizontalAlignment='Center' Margin='0,6,0,0'/><TextBlock x:Name='MockCardSubtitle1' Text='快速读懂结构与逻辑' FontSize='7' Opacity='.72' HorizontalAlignment='Center' Margin='0,3,0,0'/></StackPanel></Border>
                  <Border x:Name='MockCard2' Background='#FFF8FA' BorderBrush='#E2D5DD' BorderThickness='1' CornerRadius='8' Margin='2.5,0' Padding='8'><StackPanel VerticalAlignment='Center'><Border x:Name='MockAccent2' Width='30' Height='30' CornerRadius='15' Background='#F1A3B7' HorizontalAlignment='Center' ClipToBounds='True'><Image x:Name='MockIcon2' Stretch='UniformToFill'/></Border><TextBlock x:Name='MockCardTitle2' Text='构建新功能' FontSize='8.5' FontWeight='SemiBold' HorizontalAlignment='Center' Margin='0,6,0,0'/><TextBlock x:Name='MockCardSubtitle2' Text='把灵感稳稳变成实现' FontSize='7' Opacity='.72' HorizontalAlignment='Center' Margin='0,3,0,0'/></StackPanel></Border>
                  <Border x:Name='MockCard3' Background='#FFF8FA' BorderBrush='#E2D5DD' BorderThickness='1' CornerRadius='8' Margin='2.5,0' Padding='8'><StackPanel VerticalAlignment='Center'><Border x:Name='MockAccent3' Width='30' Height='30' CornerRadius='15' Background='#F1A3B7' HorizontalAlignment='Center' ClipToBounds='True'><Image x:Name='MockIcon3' Stretch='UniformToFill'/></Border><TextBlock x:Name='MockCardTitle3' Text='审查与验证' FontSize='8.5' FontWeight='SemiBold' HorizontalAlignment='Center' Margin='0,6,0,0'/><TextBlock x:Name='MockCardSubtitle3' Text='检查质量与边界' FontSize='7' Opacity='.72' HorizontalAlignment='Center' Margin='0,3,0,0'/></StackPanel></Border>
                  <Border x:Name='MockCard4' Background='#FFF8FA' BorderBrush='#E2D5DD' BorderThickness='1' CornerRadius='8' Margin='5,0,0,0' Padding='8'><StackPanel VerticalAlignment='Center'><Border x:Name='MockAccent4' Width='30' Height='30' CornerRadius='15' Background='#F1A3B7' HorizontalAlignment='Center' ClipToBounds='True'><Image x:Name='MockIcon4' Stretch='UniformToFill'/></Border><TextBlock x:Name='MockCardTitle4' Text='修复问题' FontSize='8.5' FontWeight='SemiBold' HorizontalAlignment='Center' Margin='0,6,0,0'/><TextBlock x:Name='MockCardSubtitle4' Text='定位根因并修复' FontSize='7' Opacity='.72' HorizontalAlignment='Center' Margin='0,3,0,0'/></StackPanel></Border>
                </UniformGrid>
                <Border x:Name='MockComposer' Grid.Row='3' Background='#FFFAFC' BorderBrush='#DFD2DA' BorderThickness='1' CornerRadius='12' Padding='13,9'>
                  <Grid><Grid.ColumnDefinitions><ColumnDefinition Width='*'/><ColumnDefinition Width='Auto'/></Grid.ColumnDefinitions><StackPanel><TextBlock x:Name='MockComposerPlaceholder' Text='和 Codex 一起构建什么？' FontSize='10.5' Opacity='.65'/><TextBlock Text='＋   完全访问     ♡' FontSize='8.5' Margin='0,9,0,0' Opacity='.62'/></StackPanel><Border x:Name='MockAccent5' Grid.Column='1' Width='31' Height='31' CornerRadius='16' Background='#E987A3' VerticalAlignment='Center'><TextBlock Text='↑' FontSize='15' FontWeight='Bold' HorizontalAlignment='Center' VerticalAlignment='Center'/></Border></Grid>
                </Border>
              </Grid>
            </Border>
            <Border Grid.RowSpan='2' Grid.ColumnSpan='2' HorizontalAlignment='Center' VerticalAlignment='Center' Background='#F2FFFFFF' BorderBrush='#D8CAD3' BorderThickness='1' CornerRadius='10' Padding='20,14' x:Name='CanvasHint'>
              <StackPanel><TextBlock Text='把图片拖到左侧开始' FontSize='14' FontWeight='SemiBold' HorizontalAlignment='Center'/><TextBlock Text='生成后将呈现完整页面，而不是背景滤镜' FontSize='10' Opacity='.65' Margin='0,4,0,0'/></StackPanel>
            </Border>
            <Border x:Name='PetFrame' Grid.Row='1' Grid.Column='1' Width='112' Height='122' HorizontalAlignment='Right' VerticalAlignment='Bottom' Margin='0,0,13,10' Background='#F3FFFFFF' BorderBrush='#D9CCD4' BorderThickness='1' CornerRadius='13' RenderTransformOrigin='.5,.5' Visibility='Collapsed'>
              <Border.RenderTransform><RotateTransform Angle='-4'/></Border.RenderTransform>
              <Image x:Name='PetImage' Width='104' Height='112' Stretch='Uniform'/>
            </Border>
          </Grid>
        </Border>

        <Grid Grid.Row='2' Margin='2,15,2,0'><Grid.ColumnDefinitions><ColumnDefinition Width='*'/><ColumnDefinition Width='Auto'/></Grid.ColumnDefinitions>
          <StackPanel><TextBlock Text='主题色谱' FontSize='11' Foreground='{StaticResource Muted}' Margin='0,0,0,9'/>
            <StackPanel Orientation='Horizontal'>
              <Border x:Name='Swatch1' Width='28' Height='28' CornerRadius='8' Background='#15131A' Margin='0,0,8,0'/><Border x:Name='Swatch2' Width='28' Height='28' CornerRadius='8' Background='#27222E' Margin='0,0,8,0'/><Border x:Name='Swatch3' Width='28' Height='28' CornerRadius='8' Background='#F4EEF8' Margin='0,0,8,0'/><Border x:Name='Swatch4' Width='28' Height='28' CornerRadius='8' Background='#F28B6D' Margin='0,0,8,0'/><Border x:Name='Swatch5' Width='28' Height='28' CornerRadius='8' Background='#75CFC2' Margin='0,0,8,0'/><Border x:Name='Swatch6' Width='28' Height='28' CornerRadius='8' Background='#3C3545'/>
            </StackPanel>
          </StackPanel>
          <TextBlock Grid.Column='1' Text='结构化本地预览  /  生成后按真实布局更新' FontFamily='Consolas' FontSize='9' Foreground='{StaticResource Muted}' VerticalAlignment='Bottom' Margin='0,0,0,4'/>
        </Grid>
      </Grid>

      <Border Grid.Column='2' Background='{StaticResource Panel}' BorderBrush='{StaticResource Border}' BorderThickness='1,0,0,0'>
        <Grid Margin='16,16'><Grid.RowDefinitions><RowDefinition Height='Auto'/><RowDefinition Height='*'/></Grid.RowDefinitions>
          <UniformGrid Columns='2'>
            <Button x:Name='FlowModeButton' Content='创作流程' Style='{StaticResource StudioButton}' Padding='8,7' Margin='0,0,4,0' Background='#282C31' BorderBrush='{StaticResource Accent}'/>
            <Button x:Name='LibraryModeButton' Content='主题库' Style='{StaticResource StudioButton}' Padding='8,7' Margin='4,0,0,0'/>
          </UniformGrid>

          <Grid Grid.Row='1'>
            <Grid x:Name='FlowPanel' Margin='3,18,3,4'><Grid.RowDefinitions><RowDefinition Height='Auto'/><RowDefinition Height='*'/><RowDefinition Height='Auto'/></Grid.RowDefinitions>
              <StackPanel><TextBlock Text='OUTPUT / 皮肤流程' FontFamily='Consolas' FontSize='14' FontWeight='Bold'/><TextBlock Text='每次生成都会自动进入主题库。' FontSize='10.5' Foreground='{StaticResource Muted}' Margin='0,6,0,20'/>
                <Grid Margin='0,0,0,14'><Grid.ColumnDefinitions><ColumnDefinition Width='30'/><ColumnDefinition Width='*'/></Grid.ColumnDefinitions><Border Width='24' Height='24' CornerRadius='12' Background='#282C31'><TextBlock Text='1' HorizontalAlignment='Center' VerticalAlignment='Center' FontSize='11'/></Border><StackPanel Grid.Column='1'><TextBlock Text='提取参考图核心元素' FontSize='12.5' FontWeight='SemiBold'/><TextBlock x:Name='StepOne' Text='等待图片和需求' FontSize='10' Foreground='{StaticResource Muted}' Margin='0,3,0,0' TextWrapping='Wrap'/></StackPanel></Grid>
                <Grid Margin='0,0,0,14'><Grid.ColumnDefinitions><ColumnDefinition Width='30'/><ColumnDefinition Width='*'/></Grid.ColumnDefinitions><Border Width='24' Height='24' CornerRadius='12' Background='#282C31'><TextBlock Text='2' HorizontalAlignment='Center' VerticalAlignment='Center' FontSize='11'/></Border><StackPanel Grid.Column='1'><TextBlock Text='生成主题与提示词包' FontSize='12.5' FontWeight='SemiBold'/><TextBlock x:Name='StepTwo' Text='等待核心元素提取' FontSize='10' Foreground='{StaticResource Muted}' Margin='0,3,0,0' TextWrapping='Wrap'/></StackPanel></Grid>
                <Grid Margin='0,0,0,14'><Grid.ColumnDefinitions><ColumnDefinition Width='30'/><ColumnDefinition Width='*'/></Grid.ColumnDefinitions><Border Width='24' Height='24' CornerRadius='12' Background='#282C31'><TextBlock Text='3' HorizontalAlignment='Center' VerticalAlignment='Center' FontSize='11'/></Border><StackPanel Grid.Column='1'><TextBlock Text='生成并校验视觉资产' FontSize='12.5' FontWeight='SemiBold'/><TextBlock x:Name='StepThree' Text='主视觉与四枚主题图标' FontSize='10' Foreground='{StaticResource Muted}' Margin='0,3,0,0' TextWrapping='Wrap'/></StackPanel></Grid>
                <Grid><Grid.ColumnDefinitions><ColumnDefinition Width='30'/><ColumnDefinition Width='*'/></Grid.ColumnDefinitions><Border Width='24' Height='24' CornerRadius='12' Background='#282C31'><TextBlock Text='4' HorizontalAlignment='Center' VerticalAlignment='Center' FontSize='11'/></Border><StackPanel Grid.Column='1'><TextBlock Text='编译、预览与应用' FontSize='12.5' FontWeight='SemiBold'/><TextBlock x:Name='StepFour' Text='预览通过后才注入 Codex' FontSize='10' Foreground='{StaticResource Muted}' Margin='0,3,0,0' TextWrapping='Wrap'/></StackPanel></Grid>
              </StackPanel>

              <StackPanel Grid.Row='1' VerticalAlignment='Bottom' Margin='0,22,0,18'>
                <ProgressBar x:Name='Progress' Height='3' IsIndeterminate='True' Visibility='Collapsed' Foreground='{StaticResource Accent}' Background='#332D3B' Margin='0,0,0,14'/>
                <Button x:Name='GenerateButton' Content='生成皮肤并应用' Style='{StaticResource PrimaryButton}' Margin='0,0,0,9'/>
                <Button x:Name='PreviewButton' Content='只生成皮肤预览' Style='{StaticResource StudioButton}' Margin='0,0,0,9'/>
                <Button x:Name='ApplyButton' Content='应用当前预览' Style='{StaticResource StudioButton}' IsEnabled='False' Margin='0,0,0,9'/>
                <Button x:Name='CancelButton' Content='取消当前任务' Style='{StaticResource StudioButton}' Visibility='Collapsed'/>
              </StackPanel>

              <StackPanel Grid.Row='2'>
                <Border Height='1' Background='{StaticResource Border}' Margin='0,0,0,15'/>
                <Button x:Name='RestoreButton' Content='恢复原版 Codex' Style='{StaticResource StudioButton}'/>
                <TextBlock Text='恢复只移除当前应用的皮肤，不删除主题库。' FontSize='9.5' Foreground='{StaticResource Muted}' TextWrapping='Wrap' Margin='2,9,2,0'/>
              </StackPanel>
            </Grid>

            <Grid x:Name='LibraryPanel' Margin='3,18,3,4' Visibility='Collapsed'><Grid.RowDefinitions><RowDefinition Height='Auto'/><RowDefinition Height='*'/><RowDefinition Height='Auto'/></Grid.RowDefinitions>
              <StackPanel Margin='0,0,0,12'>
                <TextBlock Text='LIBRARY / 主题库' FontFamily='Consolas' FontSize='14' FontWeight='Bold'/>
                <TextBlock x:Name='LibraryCountText' Text='正在读取历史主题' FontSize='10.5' Foreground='{StaticResource Muted}' Margin='0,6,0,0'/>
              </StackPanel>
              <Grid Grid.Row='1'>
                <ListBox x:Name='ThemeLibraryList' Background='Transparent' BorderThickness='0' ScrollViewer.HorizontalScrollBarVisibility='Disabled'>
                  <ListBox.ItemContainerStyle><Style TargetType='ListBoxItem'>
                    <Setter Property='Foreground' Value='{StaticResource Text}'/><Setter Property='HorizontalContentAlignment' Value='Stretch'/><Setter Property='Padding' Value='0'/><Setter Property='Margin' Value='0,0,0,5'/>
                    <Setter Property='Template'><Setter.Value><ControlTemplate TargetType='ListBoxItem'>
                      <Border x:Name='Row' Background='Transparent' CornerRadius='9' Padding='7'><ContentPresenter/></Border>
                      <ControlTemplate.Triggers>
                        <Trigger Property='IsMouseOver' Value='True'><Setter TargetName='Row' Property='Background' Value='#202328'/></Trigger>
                        <Trigger Property='IsSelected' Value='True'><Setter TargetName='Row' Property='Background' Value='#302934'/></Trigger>
                      </ControlTemplate.Triggers>
                    </ControlTemplate></Setter.Value></Setter>
                  </Style></ListBox.ItemContainerStyle>
                  <ListBox.ItemTemplate><DataTemplate>
                    <Grid ToolTip='{Binding Summary}'><Grid.ColumnDefinitions><ColumnDefinition Width='58'/><ColumnDefinition Width='*'/></Grid.ColumnDefinitions>
                      <Border Width='52' Height='40' CornerRadius='6' ClipToBounds='True' Background='#22252A'><Image Source='{Binding Thumbnail}' Stretch='UniformToFill'/></Border>
                      <StackPanel Grid.Column='1' Margin='9,1,0,0'><TextBlock Text='{Binding Name}' FontSize='11.5' FontWeight='SemiBold' Foreground='{StaticResource Text}' TextTrimming='CharacterEllipsis'/><StackPanel Orientation='Horizontal' Margin='0,5,0,0'><TextBlock Text='{Binding CreatedLabel}' FontSize='9.5' Foreground='{StaticResource Muted}'/><TextBlock Text='{Binding StatusLabel}' FontSize='9.5' FontWeight='Bold' Foreground='{StaticResource Teal}' Margin='7,0,0,0'/></StackPanel></StackPanel>
                    </Grid>
                  </DataTemplate></ListBox.ItemTemplate>
                </ListBox>
                <TextBlock x:Name='LibraryEmptyText' Text='还没有历史主题。&#x0a;生成第一套皮肤后会自动出现在这里。' FontSize='10.5' Foreground='{StaticResource Muted}' TextAlignment='Center' TextWrapping='Wrap' HorizontalAlignment='Center' VerticalAlignment='Center' Visibility='Collapsed'/>
              </Grid>
              <StackPanel Grid.Row='2' Margin='0,14,0,0'>
                <Button x:Name='LibraryApplyButton' Content='应用选中主题' Style='{StaticResource PrimaryButton}' IsEnabled='False' Margin='0,0,0,9'/>
                <Grid><Grid.ColumnDefinitions><ColumnDefinition Width='*'/><ColumnDefinition Width='*'/></Grid.ColumnDefinitions>
                  <Button x:Name='RefreshLibraryButton' Content='刷新主题库' Style='{StaticResource StudioButton}' Margin='0,0,4,0'/>
                  <Button x:Name='DeleteLibraryButton' Grid.Column='1' Content='删除主题' ToolTip='删除当前选中的历史主题' Style='{StaticResource StudioButton}' Foreground='#F6A2A2' BorderBrush='#714047' Margin='4,0,0,0' IsEnabled='False'/>
                </Grid>
                <TextBlock Text='历史主题保存在本机，不会因切换或恢复原版而删除。' FontSize='9.5' Foreground='{StaticResource Muted}' TextWrapping='Wrap' Margin='2,10,2,0'/>
              </StackPanel>
            </Grid>
          </Grid>
        </Grid>
      </Border>
    </Grid>

    <Border Grid.Row='2' Background='#111316' BorderBrush='{StaticResource Border}' BorderThickness='0,1,0,0'>
      <Grid Margin='20,0'><Grid.ColumnDefinitions><ColumnDefinition Width='*'/><ColumnDefinition Width='Auto'/></Grid.ColumnDefinitions>
        <StackPanel Orientation='Horizontal' VerticalAlignment='Center'><Ellipse Width='6' Height='6' Fill='#756A7D' Margin='0,0,8,0'/><TextBlock x:Name='StatusText' Text='准备就绪' FontSize='10.5' Foreground='{StaticResource Muted}'/></StackPanel>
        <TextBlock Grid.Column='1' Text='Portable · Local-first' FontSize='10' Foreground='#756A7D' VerticalAlignment='Center'/>
      </Grid>
    </Border>
  </Grid>
</Window>";
            using (var reader = XmlReader.Create(new StringReader(xaml))) return (Window)XamlReader.Load(reader);
        }

        private T Find<T>(string name) where T : class
        {
            return Window.FindName(name) as T;
        }

        private void BindControls()
        {
            referenceList = Find<ListBox>("ReferenceList");
            themeLibraryList = Find<ListBox>("ThemeLibraryList");
            briefBox = Find<TextBox>("BriefBox");
            presetBox = Find<ComboBox>("PresetBox");
            previewImage = Find<Image>("PreviewImage");
            petImage = Find<Image>("PetImage");
            previewTint = Find<Border>("PreviewTint");
            previewPage = Find<Border>("PreviewPage");
            previewHero = Find<Border>("PreviewHero");
            mockHeroPanel = Find<Border>("MockHeroPanel");
            mockSidebar = Find<Border>("MockSidebar");
            mockSurface = Find<Border>("MockSurface");
            mockComposer = Find<Border>("MockComposer");
            petFrame = Find<Border>("PetFrame");
            mockHeroTitle = Find<TextBlock>("MockHeroTitle");
            mockHeroSummary = Find<TextBlock>("MockHeroSummary");
            mockComposerPlaceholder = Find<TextBlock>("MockComposerPlaceholder");
            mockSignature = Find<TextBlock>("MockSignature");
            previewTitle = Find<TextBlock>("PreviewTitle");
            previewSubtitle = Find<TextBlock>("PreviewSubtitle");
            canvasHint = Find<Border>("CanvasHint");
            statusText = Find<TextBlock>("StatusText");
            runtimeText = Find<TextBlock>("RuntimeText");
            bundleText = Find<TextBlock>("BundleText");
            libraryCountText = Find<TextBlock>("LibraryCountText");
            libraryEmptyText = Find<TextBlock>("LibraryEmptyText");
            stepOne = Find<TextBlock>("StepOne");
            stepTwo = Find<TextBlock>("StepTwo");
            stepThree = Find<TextBlock>("StepThree");
            stepFour = Find<TextBlock>("StepFour");
            generateButton = Find<Button>("GenerateButton");
            previewButton = Find<Button>("PreviewButton");
            applyButton = Find<Button>("ApplyButton");
            restoreButton = Find<Button>("RestoreButton");
            cancelButton = Find<Button>("CancelButton");
            flowModeButton = Find<Button>("FlowModeButton");
            libraryModeButton = Find<Button>("LibraryModeButton");
            libraryApplyButton = Find<Button>("LibraryApplyButton");
            refreshLibraryButton = Find<Button>("RefreshLibraryButton");
            deleteLibraryButton = Find<Button>("DeleteLibraryButton");
            flowPanel = Find<Grid>("FlowPanel");
            libraryPanel = Find<Grid>("LibraryPanel");
            progress = Find<ProgressBar>("Progress");
            for (int index = 1; index <= 6; index++) swatches.Add(Find<Border>("Swatch" + index));
            for (int index = 1; index <= 4; index++) previewCards.Add(Find<Border>("MockCard" + index));
            for (int index = 1; index <= 5; index++) previewAccents.Add(Find<Border>("MockAccent" + index));
            for (int index = 1; index <= 4; index++) previewCardTitles.Add(Find<TextBlock>("MockCardTitle" + index));
            for (int index = 1; index <= 4; index++) previewCardSubtitles.Add(Find<TextBlock>("MockCardSubtitle" + index));
            for (int index = 1; index <= 4; index++) previewIconImages.Add(Find<Image>("MockIcon" + index));
        }

        private void BindEvents()
        {
            Find<Button>("AddImagesButton").Click += delegate { ChooseImages(); };
            Find<Button>("ClearImagesButton").Click += delegate { references.Clear(); ResetCanvas(); };
            generateButton.Click += async delegate { await GenerateAsync(true); };
            previewButton.Click += async delegate { await GenerateAsync(false); };
            applyButton.Click += async delegate { await ApplyAsync(); };
            restoreButton.Click += async delegate { await RestoreAsync(); };
            cancelButton.Click += delegate { CancelActiveProcess(); };
            flowModeButton.Click += delegate { ShowLibrary(false); };
            libraryModeButton.Click += delegate { ShowLibrary(true); };
            libraryApplyButton.Click += async delegate { await ApplyAsync(); };
            refreshLibraryButton.Click += delegate { RefreshThemeLibrary(false); };
            deleteLibraryButton.Click += delegate { DeleteSelectedTheme(); };
            presetBox.SelectionChanged += delegate
            {
                ComboBoxItem selected = presetBox.SelectedItem as ComboBoxItem;
                if (selected != null) SetStatus("已启用风格导演：" + Convert.ToString(selected.Content).Split('·')[0].Trim());
            };
            referenceList.SelectionChanged += delegate
            {
                ReferenceItem selected = referenceList.SelectedItem as ReferenceItem;
                if (selected != null) previewImage.Source = LoadBitmap(selected.Path);
            };
            themeLibraryList.SelectionChanged += delegate
            {
                ThemeLibraryItem selected = themeLibraryList.SelectedItem as ThemeLibraryItem;
                if (selected != null) SelectLibraryTheme(selected);
                else deleteLibraryButton.IsEnabled = false;
            };
            Window.DragOver += OnDragOver;
            Window.Drop += OnDrop;
        }

        private void OnDragOver(object sender, DragEventArgs eventArgs)
        {
            eventArgs.Effects = eventArgs.Data.GetDataPresent(DataFormats.FileDrop) ? DragDropEffects.Copy : DragDropEffects.None;
            eventArgs.Handled = true;
        }

        private void OnDrop(object sender, DragEventArgs eventArgs)
        {
            string[] files = eventArgs.Data.GetData(DataFormats.FileDrop) as string[];
            if (files != null) AddImages(files);
        }

        private void ChooseImages()
        {
            var dialog = new OpenFileDialog
            {
                Multiselect = true,
                Filter = "图片文件|*.png;*.jpg;*.jpeg;*.webp|所有文件|*.*",
                Title = "选择主题参考图片"
            };
            if (dialog.ShowDialog(Window) == true) AddImages(dialog.FileNames);
        }

        private void AddImages(IEnumerable<string> files)
        {
            string[] allowed = { ".png", ".jpg", ".jpeg", ".webp" };
            foreach (string file in files)
            {
                if (references.Count >= 32) break;
                string full = Path.GetFullPath(file);
                if (!File.Exists(full) || !allowed.Contains(Path.GetExtension(full).ToLowerInvariant())) continue;
                if (references.Any(item => String.Equals(item.Path, full, StringComparison.OrdinalIgnoreCase))) continue;
                references.Add(new ReferenceItem { Path = full, Name = Path.GetFileName(full), Thumbnail = LoadBitmap(full) });
            }
            if (references.Count > 0)
            {
                referenceList.SelectedIndex = references.Count - 1;
                stepOne.Text = references.Count + " 张本地图片已就绪";
                canvasHint.Visibility = Visibility.Collapsed;
                previewTitle.Text = "灵感画布";
                previewSubtitle.Text = "生成前可以切换素材查看构图。";
                SetStatus("素材已加入，可以开始创作");
            }
        }

        private static BitmapImage LoadBitmap(string path)
        {
            var bitmap = new BitmapImage();
            bitmap.BeginInit();
            bitmap.CacheOption = BitmapCacheOption.OnLoad;
            bitmap.UriSource = new Uri(path, UriKind.Absolute);
            bitmap.EndInit();
            bitmap.Freeze();
            return bitmap;
        }

        private static BitmapImage LoadThumbnail(string path)
        {
            var bitmap = new BitmapImage();
            bitmap.BeginInit();
            bitmap.CacheOption = BitmapCacheOption.OnLoad;
            bitmap.DecodePixelWidth = 180;
            bitmap.UriSource = new Uri(path, UriKind.Absolute);
            bitmap.EndInit();
            bitmap.Freeze();
            return bitmap;
        }

        private void ResetCanvas()
        {
            previewImage.Source = null;
            petImage.Source = null;
            foreach (Image icon in previewIconImages) icon.Source = null;
            petFrame.Visibility = Visibility.Collapsed;
            canvasHint.Visibility = Visibility.Visible;
            previewTitle.Text = "等待灵感";
            previewSubtitle.Text = "加入图片后，这里会成为你的主题画布。";
            stepOne.Text = "等待图片和需求";
            stepTwo.Text = "等待核心元素提取";
            stepThree.Text = "主视觉与四枚主题图标";
            stepFour.Text = "预览通过后才注入 Codex";
            SetStatus("准备就绪");
        }

        private async Task CheckRuntimeAsync()
        {
            SetBusy(true, "正在检查本地 Codex");
            try
            {
                CliResult result = await RunCliAsync(new[] { "doctor" });
                if (result.ExitCode == 0 && result.StandardOutput.IndexOf("\"authenticated\": true", StringComparison.OrdinalIgnoreCase) >= 0)
                {
                    runtimeText.Text = "本地 Codex 已连接";
                    SetStatus("准备就绪");
                }
                else
                {
                    runtimeText.Text = "本地 Codex 需要处理";
                    SetStatus(UsefulError(result));
                }
            }
            finally
            {
                SetBusy(false, null);
            }
        }

        private async Task GenerateAsync(bool applyAfter)
        {
            if (busy) return;
            if (references.Count == 0)
            {
                MessageBox.Show(Window, "请先加入至少一张参考图片。", "缺少素材", MessageBoxButton.OK, MessageBoxImage.Information);
                return;
            }
            string brief = briefBox.Text.Trim();
            if (brief.Length < 8)
            {
                MessageBox.Show(Window, "请再多描述一点你想要的主题皮肤。", "需求太短", MessageBoxButton.OK, MessageBoxImage.Information);
                return;
            }

            SetBusy(true, "本地 Codex 正在理解素材");
            cancelRequested = false;
            stepOne.Text = "正在提取主体、角色特征与视觉语言";
            stepTwo.Text = "等待核心元素提取";
            stepThree.Text = "等待主题提示词包";
            stepFour.Text = "等待完整视觉资产";
            try
            {
                string workRoot = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "CodexSkinStudio", "desktop-bundles");
                Directory.CreateDirectory(workRoot);
                string token = DateTime.Now.ToString("yyyyMMdd-HHmmss") + "-" + Guid.NewGuid().ToString("N").Substring(0, 6);
                string requirementsFile = Path.Combine(workRoot, token + ".txt");
                string progressFile = Path.Combine(workRoot, token + ".progress.json");
                string output = Path.Combine(workRoot, token);
                File.WriteAllText(requirementsFile, BuildDirectedBrief(brief), new UTF8Encoding(false));

                var arguments = new List<string> { "generate-skin" };
                foreach (ReferenceItem item in references)
                {
                    arguments.Add("--image");
                    arguments.Add(item.Path);
                }
                arguments.Add("--requirements-file");
                arguments.Add(requirementsFile);
                arguments.Add("--output");
                arguments.Add(output);
                arguments.Add("--progress-file");
                arguments.Add(progressFile);

                var monitorCancellation = new CancellationTokenSource();
                Task monitor = MonitorProgressAsync(progressFile, monitorCancellation.Token);
                CliResult generated;
                try
                {
                    generated = await RunCliAsync(arguments);
                }
                catch
                {
                    monitorCancellation.Cancel();
                    monitorCancellation.Dispose();
                    throw;
                }
                monitorCancellation.Cancel();
                try { await monitor; } catch (OperationCanceledException) { }
                monitorCancellation.Dispose();
                if (generated.ExitCode != 0) throw new InvalidOperationException(UsefulError(generated));
                Dictionary<string, object> response = json.DeserializeObject(generated.StandardOutput) as Dictionary<string, object>;
                if (response == null || !response.ContainsKey("bundle")) throw new InvalidOperationException("生成完成，但没有返回可用的主题包。请查看本地 Codex 状态后重试。");
                currentBundle = Convert.ToString(response["bundle"]);
                LoadBundlePreview(currentBundle);
                RefreshThemeLibrary(false);
                stepOne.Text = "核心元素已提取并保存";
                stepTwo.Text = "主题规范与资产提示词包已保存";
                stepThree.Text = "主视觉和四枚主题图标已通过校验";
                stepFour.Text = "结构化皮肤预览已就绪";
                bundleText.Text = "预览已就绪";
                applyButton.IsEnabled = true;
                SetStatus("主题已生成并保存在本地");
                if (applyAfter)
                {
                    SetBusy(false, null);
                    await ApplyAsync();
                }
            }
            catch (Exception error)
            {
                if (cancelRequested) SetStatus("任务已取消，本地素材保持不变");
                else
                {
                    SetStatus(error.Message);
                    MessageBox.Show(Window, error.Message, "生成失败", MessageBoxButton.OK, MessageBoxImage.Error);
                }
            }
            finally
            {
                SetBusy(false, null);
                cancelRequested = false;
            }
        }

        private void LoadBundlePreview(string bundle)
        {
            Dictionary<string, object> manifest = ReadJson(Path.Combine(bundle, "manifest.json"));
            Dictionary<string, object> design = ReadJson(ResolveBundleFile(bundle, StringValue(manifest, "design", null)));
            string name = StringValue(design, "name", StringValue(manifest, "name", "未命名主题"));
            string summary = StringValue(design, "summary", StringValue(manifest, "summary", "本地保存的主题作品"));
            previewTitle.Text = name;
            previewSubtitle.Text = summary;
            mockHeroTitle.Text = name;
            mockHeroSummary.Text = summary;
            mockComposerPlaceholder.Text = "和 Codex 一起构建什么？";
            mockSignature.Text = "STUDIO ✦";
            string[] defaultTitles = { "探索并理解代码", "构建新功能", "审查与验证", "修复问题" };
            string[] defaultSubtitles = { "快速读懂结构与逻辑", "把灵感稳稳变成实现", "检查质量与边界", "定位根因并修复" };
            for (int index = 0; index < previewCardTitles.Count; index++)
            {
                previewCardTitles[index].Text = defaultTitles[index];
                previewCardSubtitles[index].Text = defaultSubtitles[index];
                previewIconImages[index].Source = null;
            }
            petFrame.Visibility = Visibility.Collapsed;
            Dictionary<string, object> copy = DictionaryValue(design, "copy");
            if (copy != null)
            {
                mockHeroTitle.Text = StringValue(copy, "heroTitle", name);
                mockHeroSummary.Text = StringValue(copy, "heroSubtitle", summary);
                mockComposerPlaceholder.Text = StringValue(copy, "composerPlaceholder", mockComposerPlaceholder.Text);
                mockSignature.Text = StringValue(copy, "signature", mockSignature.Text);
                object[] titles = ArrayValue(copy, "cardTitles");
                if (titles != null)
                {
                    for (int index = 0; index < previewCardTitles.Count && index < titles.Length; index++)
                        previewCardTitles[index].Text = Convert.ToString(titles[index]);
                }
                object[] subtitles = ArrayValue(copy, "cardSubtitles");
                if (subtitles != null)
                {
                    for (int index = 0; index < previewCardSubtitles.Count && index < subtitles.Length; index++)
                        previewCardSubtitles[index].Text = Convert.ToString(subtitles[index]);
                }
            }
            Dictionary<string, object> theme = DictionaryValue(manifest, "theme");
            if (theme != null && theme.ContainsKey("background"))
                previewImage.Source = LoadBitmap(ResolveBundleFile(bundle, StringValue(theme, "background", null)));
            if (theme != null && theme.ContainsKey("icons"))
            {
                Dictionary<string, object> icons = DictionaryValue(theme, "icons");
                if (icons != null && icons.ContainsKey("path"))
                {
                    BitmapImage atlas = LoadBitmap(ResolveBundleFile(bundle, StringValue(icons, "path", null)));
                    int cellWidth = atlas.PixelWidth / 2;
                    int cellHeight = atlas.PixelHeight / 2;
                    for (int index = 0; index < previewIconImages.Count; index++)
                    {
                        int x = (index % 2) * cellWidth;
                        int y = (index / 2) * cellHeight;
                        var icon = new CroppedBitmap(atlas, new Int32Rect(x, y, cellWidth, cellHeight));
                        icon.Freeze();
                        previewIconImages[index].Source = icon;
                    }
                }
            }
            Dictionary<string, object> palette = DictionaryValue(design, "palette");
            if (palette != null)
            {
                string[] keys = { "background", "surface", "text", "accent", "accentAlt", "border" };
                string backgroundColor = StringValue(palette, "background", "#101214");
                string surfaceColor = StringValue(palette, "surface", "#1D2024");
                string surfaceAltColor = StringValue(palette, "surfaceAlt", surfaceColor);
                string textColor = StringValue(palette, "text", "#F5F4F1");
                string accentColor = StringValue(palette, "accent", "#F6A04D");
                string accentAltColor = StringValue(palette, "accentAlt", accentColor);
                string borderColor = StringValue(palette, "border", "#34383E");
                string[] colors = { backgroundColor, surfaceColor, textColor, accentColor, accentAltColor, borderColor };
                for (int index = 0; index < swatches.Count; index++) swatches[index].Background = BrushFrom(colors[index]);
                Brush background = BrushFrom(backgroundColor);
                Brush surface = BrushFrom(surfaceColor);
                Brush text = BrushFrom(textColor);
                Brush accent = BrushFrom(accentColor);
                Brush accentAlt = BrushFrom(accentAltColor);
                Brush border = BrushFrom(borderColor);
                previewPage.Background = background;
                previewPage.Resources["PreviewTextBrush"] = text;
                previewTint.Background = BrushWithOpacity(backgroundColor, 0.10);
                mockSidebar.Background = BrushWithOpacity(surfaceAltColor, 0.97);
                mockSidebar.BorderBrush = border;
                mockSurface.Background = surface;
                previewHero.BorderBrush = border;
                mockHeroPanel.Background = BrushWithOpacity(backgroundColor, 0.82);
                mockComposer.Background = BrushWithOpacity(surfaceColor, 0.97);
                mockComposer.BorderBrush = border;
                petFrame.Background = BrushWithOpacity(surfaceColor, 0.94);
                petFrame.BorderBrush = accent;
                foreach (Border card in previewCards)
                {
                    card.Background = BrushWithOpacity(surfaceColor, 0.96);
                    card.BorderBrush = border;
                }
                for (int index = 0; index < previewAccents.Count; index++) previewAccents[index].Background = index % 2 == 0 ? accent : accentAlt;
            }
            Dictionary<string, object> pet = DictionaryValue(manifest, "pet");
            if (pet != null && pet.ContainsKey("spritesheet"))
            {
                string sprite = ResolveBundleFile(bundle, StringValue(pet, "spritesheet", null));
                BitmapImage atlas = LoadBitmap(sprite);
                var frame = new CroppedBitmap(atlas, new Int32Rect(0, 0, 192, 208));
                frame.Freeze();
                petImage.Source = frame;
                petFrame.Visibility = Visibility.Visible;
            }
            canvasHint.Visibility = Visibility.Collapsed;
        }

        private void ShowLibrary(bool show)
        {
            flowPanel.Visibility = show ? Visibility.Collapsed : Visibility.Visible;
            libraryPanel.Visibility = show ? Visibility.Visible : Visibility.Collapsed;
            flowModeButton.Background = BrushFrom(show ? "#1D2024" : "#282C31");
            libraryModeButton.Background = BrushFrom(show ? "#282C31" : "#1D2024");
            flowModeButton.BorderBrush = BrushFrom(show ? "#30343A" : "#F6A04D");
            libraryModeButton.BorderBrush = BrushFrom(show ? "#F6A04D" : "#30343A");
            if (show && !busy) RefreshThemeLibrary(false);
        }

        private void RefreshThemeLibrary(bool selectLatest)
        {
            string selectedPath = currentBundle;
            string activeBundleId = ReadActiveBundleId();
            var discovered = new List<ThemeLibraryItem>();
            string root = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "CodexSkinStudio", "desktop-bundles");
            Directory.CreateDirectory(root);
            foreach (DirectoryInfo directory in new DirectoryInfo(root).GetDirectories())
            {
                try
                {
                    string manifestPath = Path.Combine(directory.FullName, "manifest.json");
                    if (!File.Exists(manifestPath)) continue;
                    Dictionary<string, object> manifest = ReadJson(manifestPath);
                    if (manifest == null) continue;
                    string kind = StringValue(manifest, "kind", null);
                    if (!String.IsNullOrWhiteSpace(kind) && !String.Equals(kind, "skin", StringComparison.OrdinalIgnoreCase)) continue;
                    Dictionary<string, object> theme = DictionaryValue(manifest, "theme");
                    string background = ResolveBundleFile(directory.FullName, StringValue(theme, "background", null));
                    string design = ResolveBundleFile(directory.FullName, StringValue(manifest, "design", null));
                    if (!File.Exists(background) || !File.Exists(design)) continue;
                    string bundleId = StringValue(manifest, "id", directory.Name);
                    bool isApplied = !String.IsNullOrWhiteSpace(activeBundleId) && String.Equals(bundleId, activeBundleId, StringComparison.OrdinalIgnoreCase);
                    DateTime created = directory.LastWriteTimeUtc;
                    DateTime parsed;
                    if (manifest.ContainsKey("createdAt") && DateTime.TryParse(Convert.ToString(manifest["createdAt"]), null, System.Globalization.DateTimeStyles.RoundtripKind, out parsed)) created = parsed.ToUniversalTime();
                    discovered.Add(new ThemeLibraryItem
                    {
                        Path = directory.FullName,
                        BundleId = bundleId,
                        Name = StringValue(manifest, "name", directory.Name),
                        Summary = StringValue(manifest, "summary", "本地主题"),
                        CreatedAt = created,
                        CreatedLabel = created.ToLocalTime().ToString("yyyy-MM-dd  HH:mm"),
                        StatusLabel = isApplied ? "使用中" : String.Empty,
                        IsApplied = isApplied,
                        Thumbnail = LoadThumbnail(background),
                    });
                }
                catch (Exception)
                {
                    // A damaged historical folder must not prevent the rest of the local library from loading.
                    continue;
                }
            }

            themeLibraryList.SelectedItem = null;
            themeLibrary.Clear();
            foreach (ThemeLibraryItem item in discovered.OrderByDescending(item => item.CreatedAt)) themeLibrary.Add(item);
            libraryCountText.Text = themeLibrary.Count == 0 ? "暂无历史主题" : "已保留 " + themeLibrary.Count + " 套本地主题";
            libraryEmptyText.Visibility = themeLibrary.Count == 0 ? Visibility.Visible : Visibility.Collapsed;
            ThemeLibraryItem selected = themeLibrary.FirstOrDefault(item => String.Equals(item.Path, selectedPath, StringComparison.OrdinalIgnoreCase));
            if (selected == null && selectLatest && themeLibrary.Count > 0) selected = themeLibrary[0];
            if (selected != null)
            {
                themeLibraryList.SelectedItem = selected;
                themeLibraryList.ScrollIntoView(selected);
            }
            libraryApplyButton.IsEnabled = !busy && selected != null;
            deleteLibraryButton.IsEnabled = !busy && selected != null && !selected.IsApplied;
        }

        private void SelectLibraryTheme(ThemeLibraryItem selected)
        {
            try
            {
                currentBundle = selected.Path;
                LoadBundlePreview(currentBundle);
                bundleText.Text = "主题库预览";
                applyButton.IsEnabled = !busy;
                libraryApplyButton.IsEnabled = !busy;
                deleteLibraryButton.IsEnabled = !busy && !selected.IsApplied;
                stepFour.Text = "已从主题库载入，可随时切换应用";
                SetStatus("正在预览：" + selected.Name);
            }
            catch (Exception error)
            {
                currentBundle = null;
                applyButton.IsEnabled = false;
                libraryApplyButton.IsEnabled = false;
                deleteLibraryButton.IsEnabled = false;
                SetStatus("主题预览失败：" + error.Message);
            }
        }

        private void DeleteSelectedTheme()
        {
            ThemeLibraryItem selected = themeLibraryList.SelectedItem as ThemeLibraryItem;
            if (selected == null || busy) return;
            string activeBundleId = ReadActiveBundleId();
            if (selected.IsApplied || (!String.IsNullOrWhiteSpace(activeBundleId) && String.Equals(selected.BundleId, activeBundleId, StringComparison.OrdinalIgnoreCase)))
            {
                deleteLibraryButton.IsEnabled = false;
                SetStatus("当前使用中的主题不能删除");
                MessageBox.Show(Window, "当前主题正在 Codex 中使用。请先应用其他主题或恢复原版，再删除它。", "无法删除", MessageBoxButton.OK, MessageBoxImage.Information);
                return;
            }
            MessageBoxResult answer = MessageBox.Show(
                Window,
                "确定永久删除“" + selected.Name + "”吗？\n\n只会删除主题库中的本地生成包；当前已经应用到 Codex 的皮肤不会被自动恢复。",
                "删除主题",
                MessageBoxButton.YesNo,
                MessageBoxImage.Warning,
                MessageBoxResult.No);
            if (answer != MessageBoxResult.Yes) return;

            try
            {
                string root = Path.GetFullPath(Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "CodexSkinStudio", "desktop-bundles")).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
                string target = Path.GetFullPath(selected.Path).TrimEnd(Path.DirectorySeparatorChar);
                if (!target.StartsWith(root, StringComparison.OrdinalIgnoreCase)) throw new InvalidOperationException("拒绝删除主题库之外的目录");
                int selectedIndex = themeLibraryList.SelectedIndex;
                Directory.Delete(target, true);
                currentBundle = null;
                RefreshThemeLibrary(false);
                if (themeLibrary.Count > 0)
                {
                    themeLibraryList.SelectedIndex = Math.Min(selectedIndex, themeLibrary.Count - 1);
                    themeLibraryList.ScrollIntoView(themeLibraryList.SelectedItem);
                }
                else
                {
                    previewImage.Source = null;
                    petImage.Source = null;
                    foreach (Image icon in previewIconImages) icon.Source = null;
                    petFrame.Visibility = Visibility.Collapsed;
                    canvasHint.Visibility = Visibility.Visible;
                    previewTitle.Text = "主题库为空";
                    previewSubtitle.Text = "下一次生成的主题会自动保存在这里。";
                    bundleText.Text = "等待生成";
                    applyButton.IsEnabled = false;
                }
                SetStatus("已删除主题：" + selected.Name);
            }
            catch (Exception error)
            {
                SetStatus("删除失败：" + error.Message);
                MessageBox.Show(Window, error.Message, "删除失败", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private static string ResolveBundleFile(string bundle, string relative)
        {
            if (String.IsNullOrWhiteSpace(relative)) throw new ArgumentException("主题文件路径为空");
            string root = Path.GetFullPath(bundle).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
            string candidate = Path.GetFullPath(Path.Combine(bundle, relative));
            if (!candidate.StartsWith(root, StringComparison.OrdinalIgnoreCase)) throw new ArgumentException("主题文件超出本地目录");
            return candidate;
        }

        private Dictionary<string, object> ReadJson(string path)
        {
            return json.DeserializeObject(File.ReadAllText(path, Encoding.UTF8)) as Dictionary<string, object>;
        }

        private string ReadActiveBundleId()
        {
            try
            {
                string activeManifest = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "CodexSkinStudio", "active", "manifest.json");
                if (!File.Exists(activeManifest)) return null;
                return StringValue(ReadJson(activeManifest), "id", null);
            }
            catch (Exception)
            {
                return null;
            }
        }

        private static Dictionary<string, object> DictionaryValue(Dictionary<string, object> source, string key)
        {
            object value;
            return source != null && source.TryGetValue(key, out value) ? value as Dictionary<string, object> : null;
        }

        private static object[] ArrayValue(Dictionary<string, object> source, string key)
        {
            object value;
            return source != null && source.TryGetValue(key, out value) ? value as object[] : null;
        }

        private static string StringValue(Dictionary<string, object> source, string key, string fallback)
        {
            object value;
            if (source == null || !source.TryGetValue(key, out value) || value == null) return fallback;
            string text = Convert.ToString(value);
            return String.IsNullOrWhiteSpace(text) ? fallback : text;
        }

        private static Brush BrushFrom(string color)
        {
            return (Brush)new BrushConverter().ConvertFromString(color);
        }

        private static Brush BrushWithOpacity(string color, double opacity)
        {
            Color parsed = (Color)ColorConverter.ConvertFromString(color);
            return new SolidColorBrush(Color.FromArgb((byte)Math.Round(opacity * 255), parsed.R, parsed.G, parsed.B));
        }

        private string BuildDirectedBrief(string userBrief)
        {
            string direction;
            switch (presetBox.SelectedIndex)
            {
                case 1:
                    direction = "清透收藏：以象牙白、浅鼠尾草绿和纸张质感为基础；用植物、邮戳或手写签名作少量重复纹样；保持大面积留白、柔和层级和清楚文字对比。";
                    break;
                case 2:
                    direction = "活力宇宙：使用青绿、明黄、珊瑚色等有节奏的撞色；加入原创手绘涂鸦、轨道和灵感符号；模块插画可以变化，但必须共享同一套线条语言。";
                    break;
                case 3:
                    direction = "未来宣言：采用克制的编辑式构图、明确网格和高对比色；以一处大型主视觉配合少量几何或宇宙纹样，界面其余区域保持干净、有秩序。";
                    break;
                case 4:
                    direction = "紫夜星光：以蓝紫、深靛和少量粉色高光营造夜空；使用星点、蝴蝶、心形或光轨中的两到三种原创符号；发光只用于焦点和交互状态。";
                    break;
                case 5:
                    direction = "舞台黑金：以黑、炭灰、暖金和奶油白构成克制奢华；使用舞台光、花朵或幕布感作为重复语言；主视觉有戏剧性，功能卡片保持安静。";
                    break;
                case 6:
                    direction = "好运开工：以朱红、暖金和象牙白为主；从祥云、铜钱、结饰等东方吉祥纹样中选择少量元素重新设计；气氛喜庆但不堆满装饰。";
                    break;
                case 7:
                    direction = "音乐彩光：以青色、浅粉和明亮中性色形成轻快节奏；使用音符、星光、声波或舞台灯中的两到三种原创符号；整体明亮、清爽、有旋律感。";
                    break;
                default:
                    direction = "自动判断：从全部参考图里找出最稳定、最有辨识度的视觉语法，形成一个原创且统一的主题方向；不要把互相冲突的风格机械拼接。";
                    break;
            }

            return String.Join("\n", new[]
            {
                "[内置视觉导演]",
                "先客观提取参考图中的主体身份、角色标志、服装与道具、构图、配色、光线、纹样和必须保留项；提取完成后再进行主题策划，禁止跳过元素提取直接取色。",
                direction,
                "先为横版主视觉、四枚功能图标和界面装饰分别生成完整图片提示词，再调用图像生成；所有生成图必须无文字、无 Logo、无水印、无假控件和无截图残片。",
                "所有正文必须清楚可读，交互色与背景要有明显区分；装饰不能遮挡输入区、侧栏和状态信息。",
                "不识别真实人物。若用户明确要求 Miku 等虚构角色主题，必须保留角色身份和标志性特征并重新构图，不能把角色降级成泛化的青色或音乐氛围。",
                "",
                "[用户需求]",
                userBrief
            });
        }

        private async Task ApplyAsync()
        {
            if (String.IsNullOrWhiteSpace(currentBundle) || busy) return;
            SetBusy(true, "正在安全安装皮肤");
            try
            {
                CliResult result = await RunCliAsync(new[] { "apply-skin", currentBundle, "--restart" });
                if (result.ExitCode != 0) throw new InvalidOperationException(UsefulError(result));
                RefreshThemeLibrary(false);
                stepFour.Text = "Codex 重启与注入已安排";
                bundleText.Text = "已应用";
                SetStatus("应用完成，Codex 将自动重新打开");
            }
            catch (Exception error)
            {
                SetStatus(error.Message);
                MessageBox.Show(Window, error.Message, "应用失败", MessageBoxButton.OK, MessageBoxImage.Error);
            }
            finally
            {
                SetBusy(false, null);
            }
        }

        private async Task RestoreAsync()
        {
            if (busy) return;
            MessageBoxResult answer = MessageBox.Show(Window, "恢复原版会移除当前皮肤并重启 Codex；已安装宠物不会受影响。继续吗？", "恢复原版", MessageBoxButton.YesNo, MessageBoxImage.Question);
            if (answer != MessageBoxResult.Yes) return;
            SetBusy(true, "正在恢复原版 Codex");
            try
            {
                CliResult result = await RunCliAsync(new[] { "restore-skin", "--restart" });
                if (result.ExitCode != 0) throw new InvalidOperationException(UsefulError(result));
                RefreshThemeLibrary(false);
                bundleText.Text = "已恢复";
                stepFour.Text = "原版 Codex 重启已安排";
                SetStatus("恢复完成，Codex 将自动重新打开");
            }
            catch (Exception error)
            {
                SetStatus(error.Message);
                MessageBox.Show(Window, error.Message, "恢复失败", MessageBoxButton.OK, MessageBoxImage.Error);
            }
            finally
            {
                SetBusy(false, null);
            }
        }

        private void SetBusy(bool value, string message)
        {
            busy = value;
            generateButton.IsEnabled = !value;
            previewButton.IsEnabled = !value;
            applyButton.IsEnabled = !value && !String.IsNullOrWhiteSpace(currentBundle);
            libraryApplyButton.IsEnabled = !value && !String.IsNullOrWhiteSpace(currentBundle);
            ThemeLibraryItem selectedTheme = themeLibraryList.SelectedItem as ThemeLibraryItem;
            deleteLibraryButton.IsEnabled = !value && selectedTheme != null && !selectedTheme.IsApplied;
            refreshLibraryButton.IsEnabled = !value;
            themeLibraryList.IsEnabled = !value;
            flowModeButton.IsEnabled = !value;
            libraryModeButton.IsEnabled = !value;
            restoreButton.IsEnabled = !value;
            progress.Visibility = value ? Visibility.Visible : Visibility.Collapsed;
            cancelButton.Visibility = value ? Visibility.Visible : Visibility.Collapsed;
            if (!String.IsNullOrWhiteSpace(message)) SetStatus(message);
        }

        private void CancelActiveProcess()
        {
            try
            {
                if (activeProcess != null && !activeProcess.HasExited) activeProcess.Kill();
                cancelRequested = true;
                SetStatus("任务已取消，本地素材保持不变");
            }
            catch (Exception error)
            {
                SetStatus("无法取消任务：" + error.Message);
            }
        }

        private async Task MonitorProgressAsync(string progressFile, CancellationToken cancellationToken)
        {
            string lastStage = null;
            while (!cancellationToken.IsCancellationRequested)
            {
                try
                {
                    if (File.Exists(progressFile))
                    {
                        string payload = File.ReadAllText(progressFile, Encoding.UTF8);
                        var serializer = new JavaScriptSerializer();
                        Dictionary<string, object> progressState = serializer.DeserializeObject(payload) as Dictionary<string, object>;
                        string stage = progressState != null && progressState.ContainsKey("stage") ? Convert.ToString(progressState["stage"]) : null;
                        string detail = progressState != null && progressState.ContainsKey("detail") ? Convert.ToString(progressState["detail"]) : null;
                        if (!String.IsNullOrWhiteSpace(stage) && stage != lastStage)
                        {
                            lastStage = stage;
                            var dispatcherOperation = Window.Dispatcher.BeginInvoke(new Action(delegate { ApplyProgressStage(stage, detail); }));
                        }
                    }
                }
                catch (IOException) { }
                catch (UnauthorizedAccessException) { }
                await Task.Delay(700, cancellationToken);
            }
        }

        private void ApplyProgressStage(string stage, string detail)
        {
            if (!String.IsNullOrWhiteSpace(detail)) SetStatus(detail);
            switch (stage)
            {
                case "extracting":
                    bundleText.Text = "提取核心元素";
                    stepOne.Text = "正在识别主体、角色特征、构图与纹样";
                    break;
                case "planning":
                    bundleText.Text = "策划主题";
                    stepOne.Text = "核心元素已提取";
                    stepTwo.Text = "正在生成主题规范和全部资产提示词";
                    break;
                case "generating-hero":
                    bundleText.Text = "生成主视觉";
                    stepTwo.Text = "主题规范与提示词包已完成";
                    stepThree.Text = "正在生成横版主题主视觉";
                    break;
                case "generating-icons":
                    bundleText.Text = "生成图标";
                    stepThree.Text = "主视觉已完成，正在生成四枚主题图标";
                    break;
                case "compiling":
                    bundleText.Text = "编译皮肤";
                    stepThree.Text = "全部视觉资产已通过校验";
                    stepFour.Text = "正在编译结构化预览";
                    break;
                case "ready":
                    bundleText.Text = "预览已就绪";
                    stepFour.Text = "完整皮肤已通过校验，等待应用";
                    break;
            }
        }

        private async Task<CliResult> RunCliAsync(IEnumerable<string> arguments)
        {
            return await Task.Run(delegate
            {
                var all = new List<string> { runtime.Cli };
                all.AddRange(arguments);
                var start = new ProcessStartInfo
                {
                    FileName = runtime.Node,
                    Arguments = String.Join(" ", all.Select(QuoteWindowsArgument)),
                    WorkingDirectory = Path.Combine(runtime.Root, "runtime"),
                    UseShellExecute = false,
                    CreateNoWindow = true,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    StandardOutputEncoding = Encoding.UTF8,
                    StandardErrorEncoding = Encoding.UTF8
                };
                using (var process = new Process { StartInfo = start })
                {
                    activeProcess = process;
                    process.Start();
                    Task<string> output = process.StandardOutput.ReadToEndAsync();
                    Task<string> error = process.StandardError.ReadToEndAsync();
                    process.WaitForExit();
                    Task.WaitAll(output, error);
                    activeProcess = null;
                    return new CliResult { ExitCode = process.ExitCode, StandardOutput = output.Result.Trim(), StandardError = error.Result.Trim() };
                }
            });
        }

        private static string QuoteWindowsArgument(string argument)
        {
            if (argument.Length > 0 && argument.All(character => !Char.IsWhiteSpace(character) && character != '"')) return argument;
            var result = new StringBuilder("\"");
            int slashes = 0;
            foreach (char character in argument)
            {
                if (character == '\\')
                {
                    slashes++;
                    continue;
                }
                if (character == '"')
                {
                    result.Append('\\', slashes * 2 + 1);
                    result.Append('"');
                    slashes = 0;
                    continue;
                }
                result.Append('\\', slashes);
                slashes = 0;
                result.Append(character);
            }
            result.Append('\\', slashes * 2);
            result.Append('"');
            return result.ToString();
        }

        private static string UsefulError(CliResult result)
        {
            string source = !String.IsNullOrWhiteSpace(result.StandardError) ? result.StandardError : result.StandardOutput;
            if (String.IsNullOrWhiteSpace(source)) return "本地运行时没有返回错误详情。";
            const string prefix = "codex-skin: ";
            int index = source.LastIndexOf(prefix, StringComparison.OrdinalIgnoreCase);
            if (index >= 0) source = source.Substring(index + prefix.Length);
            return source.Length > 700 ? source.Substring(0, 700) + "…" : source;
        }

        private void SetStatus(string message)
        {
            statusText.Text = message;
        }
    }
}
